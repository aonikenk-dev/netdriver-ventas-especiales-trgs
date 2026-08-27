interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="app-topbar">
      <span className="app-topbar__title">{title}</span>
      <span className="app-topbar__meta">Gestoria 5452 &middot; netdriver.com.ar</span>
    </header>
  );
}
