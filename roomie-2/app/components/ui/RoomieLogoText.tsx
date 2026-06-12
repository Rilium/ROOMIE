type RoomieLogoTextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface RoomieLogoTextProps {
  size?: RoomieLogoTextSize
  className?: string
  as?: 'span' | 'div'
}

export default function RoomieLogoText({
  size = 'md',
  className = '',
  as: Tag = 'span',
}: RoomieLogoTextProps) {
  return (
    <Tag className={`roomie-logo-text roomie-logo-text-${size} ${className}`.trim()} aria-label="ROOMIE">
      <span className="roomie-logo-room">ROOM</span><span className="roomie-logo-ie">IE</span>
    </Tag>
  )
}
