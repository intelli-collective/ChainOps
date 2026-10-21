export function EthereumArtwork() {
  return <svg className="auth-artwork" viewBox="0 0 440 740" aria-hidden="true">
    <defs>
      <linearGradient id="eth-left" x1="0%" y1="0%" x2="100%" y2="65%"><stop stopColor="#008d7e"/><stop offset="100%" stopColor="#00100e"/></linearGradient>
      <linearGradient id="eth-right" x1="0%" y1="0%" x2="100%" y2="65%"><stop stopColor="#004c43"/><stop offset="100%" stopColor="#000705"/></linearGradient>
      <clipPath id="eth-mesh"><path d="M220 5 5 355 220 260Z" /></clipPath>
    </defs>
    <path d="M220 5 5 355 220 485Z" fill="url(#eth-left)" stroke="#00493f"/>
    <path d="m220 5 220 350-220 130Z" fill="url(#eth-right)" stroke="#002e28"/>
    <path d="M5 355 220 260v225Z" fill="url(#eth-left)"/>
    <path d="m220 260 220 95-220 130Z" fill="url(#eth-right)" stroke="#003a33"/>
    <path d="m5 397 215 126v212Z" fill="url(#eth-left)"/>
    <path d="m220 523 220-126-220 338Z" fill="url(#eth-right)" stroke="#002e28"/>
    <path d="m57 329 55-99 55-155 53-30-108 185 108-115-108 45 108 100-108-30 55-25V75m0 65v145m-110-50 163-80m-108 75 108 30 105-85" clipPath="url(#eth-mesh)" fill="none" stroke="#08766b" strokeOpacity=".42"/>
  </svg>
}
