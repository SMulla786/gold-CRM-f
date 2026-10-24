import { Navigate, Route, Routes } from 'react-router-dom'

import { Shell } from '@/components/Shell'
import { RequireAuth, RequireLevel, homeForLevel } from '@/components/guards'
import { useAuth } from '@/lib/auth'
import { PLATFORM_NAV, useAdminNav, useAppNav } from '@/lib/nav'
import { Dashboard } from '@/pages/Dashboard'
import { Login } from '@/pages/Login'
import { ModulePlaceholder } from '@/pages/Placeholder'
import { Branches } from '@/pages/admin/Branches'
import { BusinessProfile } from '@/pages/admin/BusinessProfile'
import { Roles } from '@/pages/admin/Roles'
import { SubscriptionView } from '@/pages/admin/SubscriptionView'
import { Users } from '@/pages/admin/Users'
import { BusinessDetail } from '@/pages/platform/BusinessDetail'
import { Businesses } from '@/pages/platform/Businesses'
import { Payments } from '@/pages/platform/Payments'
import { PlatformDashboard } from '@/pages/platform/PlatformDashboard'
import { Plans } from '@/pages/platform/Plans'
import { Signups } from '@/pages/platform/Signups'

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
            <Route index element={<PlatformDashboard />} />
            <Route path="signups" element={<Signups />} />
            <Route path="businesses" element={<Businesses />} />
            <Route path="businesses/:id" element={<BusinessDetail />} />
            <Route path="plans" element={<Plans />} />
            <Route path="payments" element={<Payments />} />
          </Route>
        </Route>

        <Route element={<RequireLevel levels={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard title="Admin Dashboard" />} />
            <Route path="branches" element={<Branches />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="business" element={<BusinessProfile />} />
            <Route path="subscription" element={<SubscriptionView />} />
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
