import {
  ArrowRight,
  BarChart3,
  FileText,
  Mail,
  ReceiptText,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Placeholder — troque pelo e-mail real de contato comercial.
const CONTACT_EMAIL = 'contato@colecta.com';
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Quero o módulo Financeiro sob medida — Colecta',
)}&body=${encodeURIComponent(
  'Olá! Tenho interesse em um módulo financeiro sob medida para a minha operação. Podemos conversar?',
)}`;

interface Feature {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    Icon: ReceiptText,
    title: 'Faturamento e cobrança',
    description: 'Geração automática de faturas por contrato, cliente ou região.',
  },
  {
    Icon: BarChart3,
    title: 'Custos por operação',
    description: 'Relatórios de custo por lixeira, equipe e rota para decisões melhores.',
  },
  {
    Icon: FileText,
    title: 'Contratos e SLAs',
    description: 'Controle de contratos, prazos e indicadores de nível de serviço.',
  },
  {
    Icon: Wallet,
    title: 'Orçamento e previsão',
    description: 'Acompanhamento de orçamento e projeção de gastos do período.',
  },
];

function contact() {
  window.location.href = MAILTO;
}

export function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão financeira integrada à sua operação de coleta
        </p>
      </header>

      {/* Hero / chamada principal */}
      <Card className="overflow-hidden">
        <CardContent className="relative flex flex-col items-start gap-5 bg-[radial-gradient(circle_at_15%_15%,rgba(22,163,74,0.16),transparent_45%)] py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Disponível sob medida
            </span>
            <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">
              Um módulo financeiro feito para a sua operação
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não ativamos o Financeiro na sua conta. Nós desenvolvemos esse módulo{' '}
              <strong className="font-semibold text-foreground">sob medida</strong>, conforme as
              regras de cobrança, contratos e relatórios que a sua empresa precisa. Fale com a nossa
              equipe e montamos a solução ideal para você.
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-center rounded-2xl bg-primary/10 p-5 text-primary">
            <Wallet className="h-12 w-12" />
          </div>
        </CardContent>
      </Card>

      {/* O que pode incluir */}
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ Icon, title, description }) => (
          <Card key={title} size="sm">
            <CardContent className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA final */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h3 className="text-lg font-semibold">Pronto para ter o Financeiro sob medida?</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Entre em contato com a nossa equipe e conte como funciona a sua gestão financeira.
            Desenvolvemos o módulo de acordo com a sua necessidade.
          </p>
          <Button type="button" size="lg" onClick={contact}>
            <Mail className="h-4 w-4" />
            Entrar em contato
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">{CONTACT_EMAIL}</p>
        </CardContent>
      </Card>
    </div>
  );
}
