import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { IClientOptions, MqttClient } from 'mqtt';
import { SensorReadingsService } from '../sensor-readings/sensor-readings.service';

const DEFAULT_BROKER_URL = 'mqtt://broker.emqx.io:1883';
const DEFAULT_TOPIC = 'binovate/medidas';
const DEFAULT_TENANT_UUID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_TRASH_BIN_CODE = 'PRQ-001';

@Injectable()
export class MqttIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestService.name);
  private client?: MqttClient;

  constructor(
    private readonly config: ConfigService,
    private readonly sensorReadings: SensorReadingsService,
  ) {}

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('MQTT ingest disabled');
      return;
    }

    const brokerUrl = this.config.get<string>('MQTT_BROKER_URL') ?? DEFAULT_BROKER_URL;
    const topic = this.config.get<string>('MQTT_TOPIC') ?? DEFAULT_TOPIC;
    const username = this.config.get<string>('MQTT_USERNAME');
    const password = this.config.get<string>('MQTT_PASSWORD');
    const clientId =
      this.config.get<string>('MQTT_CLIENT_ID') ??
      `colecta-api-${process.pid}-${Math.random().toString(16).slice(2)}`;

    const options: IClientOptions = {
      clean: true,
      clientId,
      reconnectPeriod: 5000,
    };
    if (username) options.username = username;
    if (password) options.password = password;

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker ${brokerUrl}`);
      this.client?.subscribe(topic, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to MQTT topic ${topic}: ${err.message}`);
          return;
        }
        this.logger.log(`Subscribed to MQTT topic ${topic}`);
      });
    });

    this.client.on('message', (receivedTopic, payload) => {
      void this.handleMessage(receivedTopic, payload);
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT error: ${err.message}`);
    });
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const text = payload.toString('utf8');
    const tenantUuid =
      this.config.get<string>('MQTT_TENANT_UUID') ?? DEFAULT_TENANT_UUID;
    const trashBinCode =
      this.config.get<string>('MQTT_TRASH_BIN_CODE') ?? DEFAULT_TRASH_BIN_CODE;
    const trashBinId = this.config.get<string>('MQTT_TRASH_BIN_ID');

    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      this.logger.warn(`Ignoring non-JSON MQTT message on ${topic}: ${text}`);
      return;
    }

    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      this.logger.warn(`Ignoring invalid MQTT payload on ${topic}: ${text}`);
      return;
    }

    try {
      const reading = await this.sensorReadings.createFromMqttMessage(
        topic,
        message as Record<string, unknown>,
        tenantUuid,
        { trashBinCode, trashBinId },
      );
      this.logger.log(`Stored MQTT reading ${reading.id} from ${topic}`);
    } catch (err) {
      this.logger.error(
        `Failed to store MQTT message from ${topic}: ${(err as Error).message}`,
      );
    }
  }

  private isEnabled(): boolean {
    const raw = this.config.get<string>('MQTT_INGEST_ENABLED');
    return raw === undefined || !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
  }
}
