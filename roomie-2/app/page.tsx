import RoomieApp from '@/app/RoomieApp'
import LandingLegacy from '@/app/components/landing/LandingLegacy'

export default function Page() {
  return (
    <RoomieApp page="home">
      <LandingLegacy />
    </RoomieApp>
  )
}
