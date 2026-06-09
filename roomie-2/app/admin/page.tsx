import RoomieApp from '@/app/RoomieApp'
import AdminPage from '@/app/components/admin/AdminPage'

export default function Page() {
  return (
    <RoomieApp page="admin">
      <AdminPage />
    </RoomieApp>
  )
}
