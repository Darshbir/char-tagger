export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <span className="font-medium">Character Tagger</span>
        </div>
      </header>
      {children}
    </div>
  );
}
