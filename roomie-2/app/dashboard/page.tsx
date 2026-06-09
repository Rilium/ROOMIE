import RoomieApp from '@/app/RoomieApp'
import DashboardPage from '@/app/components/dashboard/DashboardPage'

export default function Page() {
  return (
    <RoomieApp page="dashboard">
      <DashboardPage />
    </RoomieApp>
  )
}
