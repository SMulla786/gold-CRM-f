import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/lib/auth'
import { LocaleProvider } from '@/lib/i18n'
// Self-hosted fonts (no runtime fetch to Google — works on a flaky shop connection).
import '@fontsource-variable/inter'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="ju-theme" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LocaleProvider>
            <TooltipProvider>
              <App />
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </LocaleProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
