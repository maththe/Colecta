export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return <div className="state">{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state state--error">Erro: {message}</div>;
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state">{label}</div>;
}
