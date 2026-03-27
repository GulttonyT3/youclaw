import { Toaster } from 'sonner'
import { useAppPreferencesStore } from '@/stores/app'

export function AppToaster() {
  const theme = useAppPreferencesStore((state) => state.theme)

  return (
    <Toaster
      theme={theme}
      position="top-right"
      visibleToasts={4}
      closeButton
      expand={false}
      duration={4000}
      offset={16}
      mobileOffset={16}
      containerAriaLabel="Notifications"
      toastOptions={{
        duration: 4000,
      }}
    />
  )
}
