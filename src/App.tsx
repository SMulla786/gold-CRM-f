import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { Shell } from '@/components/Shell'
import { RequireAuth, RequireLevel, homeForLevel } from '@/components/guards'
import { useAuth } from '@/lib/auth'
import { PLATFORM_NAV, useAdminNav, useAppNav } from '@/lib/nav'
import { Login } from '@/pages/Login'

// Route-level code splitting: each page is its own chunk, loaded on navigation.
const ModulePlaceholder = lazy(() => import('@/pages/Placeholder').then((m) => ({ default: m.ModulePlaceholder })))
const PlatformDashboard = lazy(() => import('@/pages/platform/PlatformDashboard').then((m) => ({ default: m.PlatformDashboard })))
const Signups = lazy(() => import('@/pages/platform/Signups').then((m) => ({ default: m.Signups })))
const Businesses = lazy(() => import('@/pages/platform/Businesses').then((m) => ({ default: m.Businesses })))
const BusinessDetail = lazy(() => import('@/pages/platform/BusinessDetail').then((m) => ({ default: m.BusinessDetail })))
const Plans = lazy(() => import('@/pages/platform/Plans').then((m) => ({ default: m.Plans })))
const Payments = lazy(() => import('@/pages/platform/Payments').then((m) => ({ default: m.Payments })))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const PermissionEnquiries = lazy(() => import('@/pages/admin/PermissionEnquiries').then((m) => ({ default: m.PermissionEnquiries })))
const AccessRequests = lazy(() => import('@/pages/app/AccessRequests').then((m) => ({ default: m.AccessRequests })))
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
const InvoiceSettings = lazy(() => import('@/pages/app/settings/InvoiceSettings').then((m) => ({ default: m.InvoiceSettings })))
const OpeningBalances = lazy(() => import('@/pages/app/settings/OpeningBalances').then((m) => ({ default: m.OpeningBalances })))
const Rates = lazy(() => import('@/pages/app/settings/Rates').then((m) => ({ default: m.Rates })))
const InventoryLayout = lazy(() => import('@/pages/app/inventory/InventoryLayout').then((m) => ({ default: m.InventoryLayout })))
const InventoryDashboard = lazy(() => import('@/pages/app/inventory/InventoryDashboard').then((m) => ({ default: m.InventoryDashboard })))
const ItemMasters = lazy(() => import('@/pages/app/inventory/ItemMasters').then((m) => ({ default: m.ItemMasters })))
const NewStock = lazy(() => import('@/pages/app/inventory/NewStock').then((m) => ({ default: m.NewStock })))
const StockList = lazy(() => import('@/pages/app/inventory/StockList').then((m) => ({ default: m.StockList })))
const GroupStock = lazy(() => import('@/pages/app/inventory/GroupStock').then((m) => ({ default: m.GroupStock })))
const StockImport = lazy(() => import('@/pages/app/inventory/Import').then((m) => ({ default: m.Import })))
const Shortage = lazy(() => import('@/pages/app/inventory/Shortage').then((m) => ({ default: m.Shortage })))
const StockTransfers = lazy(() => import('@/pages/app/inventory/StockTransfers').then((m) => ({ default: m.StockTransfers })))
const TagPrint = lazy(() => import('@/pages/app/inventory/TagPrint').then((m) => ({ default: m.TagPrint })))
const ScanMatch = lazy(() => import('@/pages/app/inventory/ScanMatch').then((m) => ({ default: m.ScanMatch })))
const IncomeExpense = lazy(() => import('@/pages/app/IncomeExpense').then((m) => ({ default: m.IncomeExpense })))
const DayBookLayout = lazy(() => import('@/pages/app/daybook/DayBookLayout').then((m) => ({ default: m.DayBookLayout })))
const DayBookSummary = lazy(() => import('@/pages/app/daybook/DayBookSummary').then((m) => ({ default: m.DayBookSummary })))
const AssetLedger = lazy(() => import('@/pages/app/daybook/AssetLedger').then((m) => ({ default: m.AssetLedger })))
const BillingLayout = lazy(() => import('@/pages/app/billing/BillingLayout').then((m) => ({ default: m.BillingLayout })))
const SellBill = lazy(() => import('@/pages/app/billing/SellBill').then((m) => ({ default: m.SellBill })))
const PurchaseBill = lazy(() => import('@/pages/app/billing/PurchaseBill').then((m) => ({ default: m.PurchaseBill })))
const BillList = lazy(() => import('@/pages/app/billing/BillList').then((m) => ({ default: m.BillList })))
const BillView = lazy(() => import('@/pages/app/billing/BillView').then((m) => ({ default: m.BillView })))
const BillEdit = lazy(() => import('@/pages/app/billing/BillEdit').then((m) => ({ default: m.BillEdit })))
const JustBill = lazy(() => import('@/pages/app/billing/JustBill').then((m) => ({ default: m.JustBill })))
const JustBillList = lazy(() => import('@/pages/app/billing/JustBillList').then((m) => ({ default: m.JustBillList })))
const JustBillView = lazy(() => import('@/pages/app/billing/JustBillView').then((m) => ({ default: m.JustBillView })))
const Drafts = lazy(() => import('@/pages/app/billing/Drafts').then((m) => ({ default: m.Drafts })))
const DraftApprovals = lazy(() => import('@/pages/app/billing/DraftApprovals').then((m) => ({ default: m.DraftApprovals })))
const OrdersLayout = lazy(() => import('@/pages/app/orders/OrdersLayout').then((m) => ({ default: m.OrdersLayout })))
const NewOrder = lazy(() => import('@/pages/app/orders/NewOrder').then((m) => ({ default: m.NewOrder })))
const OrderList = lazy(() => import('@/pages/app/orders/OrderList').then((m) => ({ default: m.OrderList })))
const OrderDetail = lazy(() => import('@/pages/app/orders/OrderDetail').then((m) => ({ default: m.OrderDetail })))
const KarigarIssues = lazy(() => import('@/pages/app/orders/KarigarIssues').then((m) => ({ default: m.KarigarIssues })))
const RepairBoard = lazy(() => import('@/pages/app/repair/RepairBoard').then((m) => ({ default: m.RepairBoard })))
const GirviLayout = lazy(() => import('@/pages/app/girvi/GirviLayout').then((m) => ({ default: m.GirviLayout })))
const NewGirvi = lazy(() => import('@/pages/app/girvi/NewGirvi').then((m) => ({ default: m.NewGirvi })))
const GirviList = lazy(() => import('@/pages/app/girvi/GirviList').then((m) => ({ default: m.GirviList })))
const GirviDetail = lazy(() => import('@/pages/app/girvi/GirviDetail').then((m) => ({ default: m.GirviDetail })))
const GirviDefaults = lazy(() => import('@/pages/app/settings/GirviDefaults').then((m) => ({ default: m.GirviDefaults })))
const ExchangeLayout = lazy(() => import('@/pages/app/trade/ExchangeLayout').then((m) => ({ default: m.ExchangeLayout })))
const NewExchange = lazy(() => import('@/pages/app/trade/NewExchange').then((m) => ({ default: m.NewExchange })))
const ExchangeList = lazy(() => import('@/pages/app/trade/ExchangeList').then((m) => ({ default: m.ExchangeList })))
const KachaPool = lazy(() => import('@/pages/app/trade/KachaPool').then((m) => ({ default: m.KachaPool })))
const BuySellLayout = lazy(() => import('@/pages/app/trade/BuySellLayout').then((m) => ({ default: m.BuySellLayout })))
const NewBuySell = lazy(() => import('@/pages/app/trade/NewBuySell').then((m) => ({ default: m.NewBuySell })))
const BuySellList = lazy(() => import('@/pages/app/trade/BuySellList').then((m) => ({ default: m.BuySellList })))
const BhavBookings = lazy(() => import('@/pages/app/trade/BhavBookings').then((m) => ({ default: m.BhavBookings })))
const SchemesLayout = lazy(() => import('@/pages/app/schemes/SchemesLayout').then((m) => ({ default: m.SchemesLayout })))
const SchemeList = lazy(() => import('@/pages/app/schemes/SchemeList').then((m) => ({ default: m.SchemeList })))
const SchemeGroups = lazy(() => import('@/pages/app/schemes/SchemeGroups').then((m) => ({ default: m.SchemeGroups })))
const EnrollMember = lazy(() => import('@/pages/app/schemes/EnrollMember').then((m) => ({ default: m.EnrollMember })))
const BulkEnroll = lazy(() => import('@/pages/app/schemes/BulkEnroll').then((m) => ({ default: m.BulkEnroll })))
const MemberList = lazy(() => import('@/pages/app/schemes/MemberList').then((m) => ({ default: m.MemberList })))
const MemberDetail = lazy(() => import('@/pages/app/schemes/MemberDetail').then((m) => ({ default: m.MemberDetail })))
const SchemeDues = lazy(() => import('@/pages/app/schemes/SchemeDues').then((m) => ({ default: m.SchemeDues })))
const SchemeTransactions = lazy(() => import('@/pages/app/schemes/SchemeTransactions').then((m) => ({ default: m.SchemeTransactions })))
const SchemeDayBook = lazy(() => import('@/pages/app/schemes/SchemeDayBook').then((m) => ({ default: m.SchemeDayBook })))
const UdhariLayout = lazy(() => import('@/pages/app/udhari/UdhariLayout').then((m) => ({ default: m.UdhariLayout })))
const NewUdhar = lazy(() => import('@/pages/app/udhari/NewUdhar').then((m) => ({ default: m.NewUdhar })))
const UdharLedger = lazy(() => import('@/pages/app/udhari/UdharLedger').then((m) => ({ default: m.UdharLedger })))
const UdharList = lazy(() => import('@/pages/app/udhari/UdharList').then((m) => ({ default: m.UdharList })))
const UdharPendingBills = lazy(() => import('@/pages/app/udhari/PendingBills').then((m) => ({ default: m.PendingBills })))
const UdharStatement = lazy(() => import('@/pages/app/udhari/Statement').then((m) => ({ default: m.Statement })))
const OwnerDashboard = lazy(() => import('@/pages/app/OwnerDashboard').then((m) => ({ default: m.OwnerDashboard })))
const GstReports = lazy(() => import('@/pages/app/billing/GstReports').then((m) => ({ default: m.GstReports })))

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
            <Route index element={<AdminDashboard />} />
            <Route path="branches" element={<Branches />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="permission-enquiries" element={<PermissionEnquiries />} />
            <Route path="business" element={<BusinessProfile />} />
            <Route path="subscription" element={<SubscriptionView />} />
          </Route>
        </Route>

        <Route element={<RequireLevel levels={['ADMIN', 'BRANCH_USER']} />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="dashboard" element={<OwnerDashboard />} />
            <Route path="access-requests" element={<AccessRequests />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/app/settings/parties" replace />} />
              <Route path="parties" element={<Parties />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="hsn" element={<Hsn />} />
              <Route path="general" element={<General />} />
              <Route path="invoice" element={<InvoiceSettings />} />
              <Route path="rates" element={<Rates />} />
              <Route path="opening" element={<OpeningBalances />} />
              <Route path="girvi" element={<GirviDefaults />} />
            </Route>
            <Route path="inventory" element={<InventoryLayout />}>
              <Route index element={<InventoryDashboard />} />
              <Route path="masters" element={<ItemMasters />} />
              <Route path="new" element={<NewStock />} />
              <Route path="stock" element={<StockList />} />
              <Route path="groups" element={<GroupStock />} />
              <Route path="import" element={<StockImport />} />
              <Route path="shortage" element={<Shortage />} />
              <Route path="transfers" element={<StockTransfers />} />
              <Route path="tags" element={<TagPrint />} />
              <Route path="scan" element={<ScanMatch />} />
            </Route>
            <Route path="income_expense" element={<IncomeExpense />} />
            <Route path="daybook" element={<DayBookLayout />}>
              <Route index element={<DayBookSummary />} />
              <Route path=":asset" element={<AssetLedger />} />
            </Route>
            <Route path="billing" element={<BillingLayout />}>
              <Route index element={<SellBill />} />
              <Route path="purchase" element={<PurchaseBill />} />
              <Route path="list" element={<BillList />} />
              <Route path="gst" element={<GstReports />} />
              <Route path="just" element={<JustBill />} />
              <Route path="just/list" element={<JustBillList />} />
              <Route path="just/view/:id" element={<JustBillView />} />
              <Route path="drafts" element={<Drafts />} />
              <Route path="approvals" element={<DraftApprovals />} />
              <Route path="edit/:id" element={<BillEdit />} />
              <Route path="view/:id" element={<BillView />} />
            </Route>
            <Route path="orders" element={<OrdersLayout />}>
              <Route index element={<OrderList />} />
              <Route path="new" element={<NewOrder />} />
              <Route path="karigar" element={<KarigarIssues />} />
              <Route path=":id" element={<OrderDetail />} />
            </Route>
            <Route path="repair" element={<RepairBoard />} />
            <Route path="exchange" element={<ExchangeLayout />}>
              <Route index element={<ExchangeList />} />
              <Route path="new" element={<NewExchange />} />
              <Route path="kacha" element={<KachaPool />} />
            </Route>
            <Route path="buy_sell" element={<BuySellLayout />}>
              <Route index element={<BuySellList />} />
              <Route path="new" element={<NewBuySell />} />
              <Route path="bhav" element={<BhavBookings />} />
            </Route>
            <Route path="schemes" element={<SchemesLayout />}>
              <Route index element={<SchemeList />} />
              <Route path="groups" element={<SchemeGroups />} />
              <Route path="enroll" element={<EnrollMember />} />
              <Route path="bulk-enroll" element={<BulkEnroll />} />
              <Route path="members" element={<MemberList />} />
              <Route path="members/:id" element={<MemberDetail />} />
              <Route path="dues" element={<SchemeDues />} />
              <Route path="transactions" element={<SchemeTransactions />} />
              <Route path="day-book" element={<SchemeDayBook />} />
              <Route path="anjuman" element={<SchemeList kind="ANJUMAN" />} />
            </Route>
            <Route path="girvi" element={<GirviLayout />}>
              <Route index element={<GirviList />} />
              <Route path="new" element={<NewGirvi />} />
              <Route path=":id" element={<GirviDetail />} />
            </Route>
            <Route path="udhari" element={<UdhariLayout />}>
              <Route index element={<NewUdhar />} />
              <Route path="ledger" element={<UdharLedger />} />
              <Route path="list" element={<UdharList />} />
              <Route path="pending" element={<UdharPendingBills />} />
              <Route path="statement/:partyId" element={<UdharStatement />} />
            </Route>
            <Route path=":moduleKey" element={<ModulePlaceholder />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<div className="grid min-h-screen place-items-center">404 — not found</div>} />
    </Routes>
  )
}
