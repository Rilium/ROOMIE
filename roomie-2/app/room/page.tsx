import RoomieApp from '@/app/RoomieApp'
import BookingPage from '@/app/components/booking/BookingPage'

export default function Page() {
  return (
    <RoomieApp page="room">
      <BookingPage />
    </RoomieApp>
  )
}
