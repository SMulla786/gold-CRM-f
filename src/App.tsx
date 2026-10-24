import { Navigate, Route, Routes } from 'react-router-dom'

import { Shell } from '@/components/Shell'
import { RequireAuth, RequireLevel, homeForLevel } from '@/components/guards'
import { useAuth } from '@/lib/auth'
import { PLATFORM_NAV, useAdminNav, useAppNav } from '@/lib/nav'
import { Dashboard } from '@/pages/Dashboard'
import { Login } from '@/pages/Login'
import { ModulePlaceholder, Placeholder } from '@/pages/Placeholder'

function HomeRedirect() {
  const { me } = useAuth()
  return <Navigate to={me ? homeForLevel(me.level) : '/login'} replace />
}

const PlatformLayout = () => <Shell area="Platform" nav={PLATFORM_NAV} />
const AdminLayout = () => <Shell area="Admin" nav={useAdminNav()} showBranch />
const AppLayout = () => <Shell area="Store" nav={useAppNav()} showBranch />

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<RequireLevel levels={['SUPER_ADMIN']} />}>
          <Route path="/platform" element={<PlatformLayout />}>
            <Route index element={<Dashboard title="Platform Dashboard" />} />
            <Route path="signups" element={<Placeholder title="Sign-up Requests" />} />
            <Route path="businesses" element={<Placeholder title="Businesses" />} />
            <Route path="plans" element={<Placeholder title="Plans" />} />
            <Route path="payments" element={<Placeholder title="Payments" />} />
          </Route>
        </Route>

        <Route element={<RequireLevel levels={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard title="Admin Dashboard" />} />
            <Route path="branches" element={<Placeholder title="Branches" />} />
            <Route path="users" element={<Placeholder title="Users" />} />
            <Route path="roles" element={<Placeholder title="Roles & Permissions" />} />
            <Route path="business" element={<Placeholder title="Business Settings" />} />
            <Route path="subscription" element={<Placeholder title="Subscription" />} />
          </Route>
        </Route>

        <Route element={<RequireLevel levels={['ADMIN', 'BRANCH_USER']} />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard title="Store Dashboard" />} />
            <Route path=":moduleKey" element={<ModulePlaceholder />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<div className="grid min-h-screen place-items-center">404 — not found</div>} />
    </Routes>
  )
}
