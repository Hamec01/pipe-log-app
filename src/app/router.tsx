import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './layout'
import { DashboardPage } from '../pages/Dashboard'
import { BundlesPage } from '../pages/Bundles'
import { BundleDetailPage } from '../pages/BundleDetail'
import { LogDetailPage } from '../pages/LogDetail'
import { CreateLogPage } from '../pages/CreateLog'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'bundles', element: <BundlesPage /> },
      { path: 'bundle/:id', element: <BundleDetailPage /> },
      { path: 'log/:id', element: <LogDetailPage /> },
      { path: 'create-log', element: <CreateLogPage /> },
    ],
  },
])
