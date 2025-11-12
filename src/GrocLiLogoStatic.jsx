export default function GrocLiLogoStatic({ size = 120 }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <img
        src="/GrocLiLogo.png" // or wherever your logo image is
        alt="GrocLi Logo"
        style={{ width: size, height: size }}
      />
    </div>
  )
}
