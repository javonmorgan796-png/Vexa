import { Router, type IRouter } from "express";

const router: IRouter = Router();
const LOGO_DEV_TOKEN = process.env["LOGO_DEV_TOKEN"]?.trim();

export interface BettingPlatformItem {
  id: string;
  name: string;
  domain: string;
  color: string;
  logoUrl: string | null;
}

export interface TelecomNetworkItem {
  id: string;
  name: string;
  domain: string;
  color: string;
  text: string;
  logoUrl: string | null;
}

const BETTING_PLATFORM_CATALOG: Array<{
  id: string;
  name: string;
  domain: string;
  color: string;
}> = [
  { id: "bet9ja", name: "Bet9ja", domain: "bet9ja.com", color: "#006400" },
  { id: "sporty", name: "SportyBet", domain: "sportybet.com", color: "#E11D48" },
  { id: "betking", name: "BetKing", domain: "betking.com", color: "#1D4ED8" },
  { id: "1xbet", name: "1xBet", domain: "1xbet.com", color: "#0284C7" },
  { id: "nairabet", name: "NairaBet", domain: "nairabet.com", color: "#15803D" },
  { id: "msport", name: "MSport", domain: "msport.com", color: "#D97706" },
];

const TELECOM_NETWORK_CATALOG: Array<{
  id: string;
  name: string;
  domain: string;
  color: string;
  text: string;
}> = [
  { id: "mtn", name: "MTN", domain: "mtn.ng", color: "#FFD700", text: "#000000" },
  { id: "airtel", name: "Airtel", domain: "airtel.com.ng", color: "#DC2626", text: "#FFFFFF" },
  { id: "glo", name: "Glo", domain: "gloworld.com", color: "#16A34A", text: "#FFFFFF" },
  { id: "9mobile", name: "9mobile", domain: "9mobile.com.ng", color: "#1D7F3E", text: "#FFFFFF" },
];

function buildDomainLogoUrl(domain: string): string | null {
  if (!LOGO_DEV_TOKEN) return null;
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=96&format=png`;
}

router.get("/betting/platforms", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  const platforms: BettingPlatformItem[] = BETTING_PLATFORM_CATALOG.map((item) => ({
    ...item,
    logoUrl: buildDomainLogoUrl(item.domain),
  }));
  res.json({ platforms });
});

router.get("/telecom/networks", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  const networks: TelecomNetworkItem[] = TELECOM_NETWORK_CATALOG.map((item) => ({
    ...item,
    logoUrl: buildDomainLogoUrl(item.domain),
  }));
  res.json({ networks });
});

export default router;
