export function GlobalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-gray-200 dark:bg-gray-950 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center py-4 sm:py-6 space-y-1">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-center">
            © {currentYear} Torvex Inc. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            SmartSBA — School-Based Assessment Platform
          </p>
        </div>
      </div>
    </footer>
  );
}
