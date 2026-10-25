import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { Shell } from '@/components/Shell'
import { RequireAuth, RequireLevel, homeForLevel } from '@/components/guards'
import { useAuth } from '@/lib/auth'
import { PLATFORM_NAV, useAdminNav, useAppNav } from '@/lib/nav'
import { Login } from '@/pages/Login'

// Route-level code splitting: each page is its own chunk, loaded on navigation.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const ModulePlaceholder = lazy(() => import('@/pages/Placeholder').then((m) => ({ default: m.ModulePlaceholder })))
const PlatformDashboard = lazy(() => import('@/pages/platform/PlatformDashboard').then((m) => ({ default: m.PlatformDashboard })))
const Signups = lazy(() => import('@/pages/platform/Signups').then((m) => ({ default: m.Signups })))
const Businesses = lazy(() => import('@/pages/platform/Businesses').then((m) => ({ default: m.Businesses })))
const BusinessDetail = lazy(() => import('@/pages/platform/BusinessDetail').then((m) => ({ default: m.BusinessDetail })))
const Plans = lazy(() => import('@/pages/platform/Plans').then((m) => ({ default: m.Plans })))
const Payments = lazy(() => import('@/pages/platform/Payments').then((m) => ({ default: m.Payments })))
const Branches = lazy(() => import('@/pages/admin/Branches').then((m) => ({ default: m.Branches })))
const Users = lazy(() => import('@/pages/admin/Users').then((m) => ({ default: m.Users })))
const Roles = lazy(() => import('@/pages/admin/Roles').then((m) => ({ default: m.Roles })))
const BusinessProfile = lazy(() => import('@/pages/admin/BusinessProfile').then((m) => ({ default: m.BusinessProfile })))
const SubscriptionView = lazy(() => import('@/pages/admin/SubscriptionView').then((m) => ({ default: m.SubscriptionView })))
const SettingsLayout = lazy(() => import('@/pages/app/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout })))
const Parties = lazy(() => import('@/pages/app/settings/Parties').then((m) => ({ default: m.Parties })))
const BankAccounts = lazy(() => import('@/pages/app/settings/BankAccounts').then((m) => ({ default: m.BankAccounts })))
const Hsn = lazy(() => import('@/pages/app/settings/Hsn').then((m) => ({ default: m.Hsn })))
const General = lazy(() => import('@/pages/app/settings/General').then((m) => ({ default: m.General })))
const Rates = lazy(() => import('@/pages/app/settings/Rates').then((m) => ({ default: m.Rates })))
const InventoryLayout = lazy(() => import('@/pages/app/inventory/InventoryLayout').then((m) => ({ default: m.InventoryLayout })))
const InventoryDashboard = lazy(() => import('@/pages/app/inventory/InventoryDashboard').then((m) => ({ default: m.InventoryDashboard })))
const ItemMasters = lazy(() => import('@/pages/app/inventory/ItemMasters').then((m) => ({ default: m.ItemMasters })))
const NewStock = lazy(() => import('@/pages/app/inventory/NewStock').then((m) => ({ default: m.NewStock })))
const StockList = lazy(() => import('@/pages/app/inventory/StockList').then((m) => ({ default: m.StockList })))
const GroupStock = lazy(() => import('@/pages/app/inventory/GroupStock').then((m) => ({ default: m.GroupStock })))
const StockImport = lazy(() => import('@/pages/app/inventory/Import').then((m) => ({ default: m.Import })))
const Shortage = lazy(() => import('@/pages/app/inventory/Shortage').then((m) => ({ default: m.Shortage })))

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
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/app/settings/parties" replace />} />
              <Route path="parties" element={<Parties />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="hsn" element={<Hsn />} />
              <Route path="general" element={<General />} />
              <Route path="rates" element={<Rates />} />
            </Route>
            <Route path="inventory" element={<InventoryLayout />}>
              <Route index element={<InventoryDashboard />} />
              <Route path="masters" element={<ItemMasters />} />
              <Route path="new" element={<NewStock />} />
              <Route path="stock" element={<StockList />} />
              <Route path="groups" element={<GroupStock />} />
              <Route path="import" element={<StockImport />} />
              <Route path="shortage" element={<Shortage />} />
            </Route>
            <Route path=":moduleKey" element={<ModulePlaceholder />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<div className="grid min-h-screen place-items-center">404 — not found</div>} />
    </Routes>
  )
}
