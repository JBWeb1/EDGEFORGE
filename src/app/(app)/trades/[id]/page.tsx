import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocalTime } from "@/components/local-time";
import { Badge, Button, ButtonLink, Card, CardTitle, PageHeader, cn } from "@/components/ui";
import { computeTradeResult, isClosed } from "@/lib/analytics/trade-math";
import { getTrade, toTradeInput } from "@/lib/data/trades";
import { formatDuration, money, plain, pnlClass, rMultiple, ratio } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { deleteTrade } from "../actions";
import { DeleteTradeButton } from "./delete-button";

export const metadata: Metadata = { title: "Trade" };

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-700/60 py-2 text-sm last:border-0">
      <dt className="text-navy-400">{label}</dt>
      <dd className={cn("num text-right text-white", className)}>{children}</dd>
    </div>
  );
}

export default async function TradePage({ params }: PageProps<"/trades/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const trade = await getTrade(user.id, id);
  if (!trade) notFound();

  const input = toTradeInput(trade);
  const result = isClosed(input) ? computeTradeResult(input) : null;
  const cur = trade.account.currency;

  return (
    <>
      <PageHeader
        title={`${trade.symbol} · ${trade.direction === "LONG" ? "Long" : "Short"}`}
        description={`${trade.account.name}${trade.importBatchId ? " · imported" : ""}`}
        actions={
          <>
            <ButtonLink href={`/trades/${trade.id}/edit`} variant="secondary">Edit</ButtonLink>
            <DeleteTradeButton id={trade.id} action={deleteTrade}>
              <Button variant="danger" type="submit">Delete</Button>
            </DeleteTradeButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle action={result ? <Badge tone={result.outcome === "WIN" ? "profit" : result.outcome === "LOSS" ? "loss" : "neutral"}>{result.outcome.toLowerCase()}</Badge> : <Badge tone="info">open</Badge>}>
            Result
          </CardTitle>
          {result ? (
            <dl>
              <Row label="Net P&L" className={cn("text-lg font-semibold", pnlClass(result.netPnl))}>{money(result.netPnl, cur, { signed: true })}</Row>
              <Row label="Gross P&L" className={pnlClass(result.grossPnl)}>{money(result.grossPnl, cur, { signed: true })}</Row>
              <Row label="Fees">{money(result.fees, cur)}</Row>
              <Row label="R multiple" className={pnlClass(result.rMultiple)}>{rMultiple(result.rMultiple)}</Row>
              <Row label="Initial risk">{result.initialRisk ? money(result.initialRisk, cur) : "No stop set"}</Row>
              <Row label="Planned reward : risk">{result.plannedRewardRisk ? `${ratio(result.plannedRewardRisk.toNumber())} : 1` : "—"}</Row>
              <Row label="Holding time">{formatDuration(result.holdingMs)}</Row>
            </dl>
          ) : (
            <p className="text-sm text-navy-300">This trade is open. Add an exit price and time to include it in your statistics.</p>
          )}
        </Card>
        <Card>
          <CardTitle>Execution</CardTitle>
          <dl>
            <Row label="Quantity">{plain(trade.quantity)}</Row>
            <Row label="Multiplier">{plain(trade.multiplier)}</Row>
            <Row label="Entry">{plain(trade.entryPrice)}</Row>
            <Row label="Entry time"><LocalTime value={trade.entryAt} /></Row>
            <Row label="Exit">{plain(trade.exitPrice)}</Row>
            <Row label="Exit time"><LocalTime value={trade.exitAt} /></Row>
            <Row label="Stop loss">{plain(trade.stopLoss)}</Row>
            <Row label="Take profit">{plain(trade.takeProfit)}</Row>
          </dl>
        </Card>
        <Card>
          <CardTitle>Context</CardTitle>
          <dl>
            <Row label="Setup">{trade.setup ?? "—"}</Row>
            <Row label="Strategy">{trade.strategy ?? "—"}</Row>
            <Row label="Emotion">{trade.emotion ? trade.emotion.charAt(0) + trade.emotion.slice(1).toLowerCase() : "—"}</Row>
            <Row label="Followed rules">{trade.followedRules === null ? "—" : trade.followedRules ? "Yes" : "No"}</Row>
            <Row label="Confidence">{trade.confidence ? `${trade.confidence} / 5` : "—"}</Row>
          </dl>
          {trade.screenshotUrl && (
            <a href={trade.screenshotUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm text-electric-soft hover:underline">
              Open screenshot ↗
            </a>
          )}
        </Card>
        {trade.notes && (
          <Card className="lg:col-span-3">
            <CardTitle>Notes</CardTitle>
            <p className="whitespace-pre-wrap text-sm text-navy-200">{trade.notes}</p>
          </Card>
        )}
      </div>
    </>
  );
}
