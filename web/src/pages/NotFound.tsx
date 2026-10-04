import { Link } from "react-router-dom";

import { CandleBackground, FlameMark } from "@/components/emmaus/Candle";

const NotFound = () => (
  <main className="relative flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <CandleBackground />
    <FlameMark size={40} />
    <h1 className="font-serif text-4xl font-semibold text-parchment">This road ends here</h1>
    <p className="max-w-sm font-serif text-lg italic text-mist">“Thy word is a lamp unto my feet, and a light unto my path.” — Ps. 119:105</p>
    <Link to="/" className="bg-gold-gradient pressable mt-2 rounded-full px-5 py-2.5 font-semibold text-ink">
      Return to Today
    </Link>
  </main>
);

export default NotFound;
