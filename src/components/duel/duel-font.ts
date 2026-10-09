import { Press_Start_2P } from "next/font/google";

/** The Duel's in-game pixel type, loaded only where the game is. */
export const duelPixelFont = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-family-press-start",
  display: "swap",
});
