import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { ticketPdf } from "@/lib/pdf";
import { db, transaction } from "@/lib/db";
import * as service from "@/lib/service";
import { staffSession, login, logout } from "@/lib/auth";
import { money, time, dateLabel } from "@/lib/types";
import type { Bus, Route } from "@/lib/types";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(req: NextRequest) {
  try {
    const p = req.nextUrl.pathname.replace("/api/", "").split("/");
    const search = req.nextUrl.searchParams;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    if (req.method !== "GET") {
      if (
        !isAllowedRequestOrigin(
          req.headers.get("origin"),
          req.nextUrl.href,
          req.headers.get("host"),
        )
      )
        throw new service.Fault("Request origin is not allowed.", 403);
    }
    const json = (value: unknown, status = 200) =>
      NextResponse.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        throw new service.Fault("A valid JSON request is required.");
      }
    }
    if (p[0] === "health")
      return json({ ok: true, database: "postgresql", demo: true });
    if (p[0] === "catalog")
      return json({
        routes: (
          await (await db()).query<{ data: Route }>("SELECT data FROM routes")
        ).rows.map((r) => r.data),
        buses: (
          await (await db()).query<{ data: Bus }>("SELECT data FROM buses")
        ).rows.map((r) => r.data),
        policy: await service.policy(),
      });
    if (p[0] === "trips" && req.method === "GET") {
      if (p[1]) return json(await service.trip(p[1]));
      return json(
        await service.trips({
          date: search.get("date") || undefined,
          from: search.get("from") || undefined,
          to: search.get("to") || undefined,
        }),
      );
    }
    if (p[0] === "holds") {
      await service.limit(`holds:${ip}`, 120);
      if (req.method === "POST")
        return json(await service.hold(service.holdSchema.parse(body)), 201);
      if (req.method === "DELETE") {
        const data = z
          .object({ id: z.string().uuid(), owner: z.string().min(20) })
          .parse(body);
        await service.release(data.id, data.owner);
        return json({ ok: true });
      }
    }
    if (p[0] === "bookings" && !p[1] && req.method === "POST") {
      await service.limit(`booking:${ip}`, 60);
      return json(
        await service.confirm(service.confirmSchema.parse(body)),
        201,
      );
    }
    if (p[0] === "bookings" && p[1]) {
      await service.limit(`retrieval:${ip}`, 120);
      const access = req.headers.get("x-booking-access") || undefined;
      let staff = false;
      if (!access) {
        try {
          await staffSession();
          staff = true;
        } catch {}
      }
      const b = await service.booking(decodeURIComponent(p[1]), access, staff);
      if (p[2] === "cancel" && req.method === "POST") {
        if (staff) await staffSession(true);
        await service.cancel(b.id, staff ? "admin" : "guest", staff);
        return json({ ok: true });
      }
      if (p[2] === "pdf") {
        return new NextResponse(
          await ticketPdf(
            b,
            process.env.APP_URL || req.nextUrl.origin,
            (await service.policy()).arrivalMinutes,
            search.get("lang") === "si"
              ? "si"
              : search.get("lang") === "ta"
                ? "ta"
                : "en",
          ),
          {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${b.reference}.pdf"`,
              "Cache-Control": "private, no-store",
            },
          },
        );
      }
      return json({
        ...b,
        qrImages: await Promise.all(
          b.tickets.map((t) =>
            QRCode.toDataURL(
              `${process.env.APP_URL || req.nextUrl.origin}/verify/${t.qr_token}`,
              { width: 360, margin: 3, errorCorrectionLevel: "M" },
            ),
          ),
        ),
      });
    }
    if (p[0] === "verify" && p[1]) {
      await service.limit(`verify:${ip}`, 120);
      return json(await service.verify(p[1]));
    }
    if (p[0] === "staff") {
      const readOnly = ["session", "data", "booking"];
      if (req.method !== "POST" && !readOnly.includes(p[1]))
        throw new service.Fault("Use POST for staff actions.", 405);
      if (p[1] === "login" && req.method === "POST") {
        const d = z
          .object({
            username: z.string().max(60),
            password: z.string().max(200),
          })
          .parse(body);
        return json(await login(d.username, d.password, ip));
      }
      if (p[1] === "logout") {
        await logout();
        return json({ ok: true });
      }
      const actor = await staffSession();
      if (p[1] === "session") return json(actor);
      if (p[1] === "checkin") {
        const d = z
          .object({ token: z.string().max(200), tripId: z.string().max(120) })
          .parse(body);
        return json(await service.checkIn(d.token, d.tripId, actor.id));
      }
      if (p[1] === "data") {
        const d = await db();
        const ts = await service.trips({
          date: search.get("date") || undefined,
          all: true,
        });
        const bs = await d.query(
          `SELECT b.id,b.reference,b.name,b.phone,b.status,b.trip_id,b.total,b.created_at,(SELECT json_agg(json_build_object('id',t.id,'seat',t.seat,'passenger',t.passenger,'status',t.status)) FROM tickets t WHERE t.booking_id=b.id) AS tickets FROM bookings b ORDER BY created_at DESC LIMIT 200`,
        );
        return json({
          trips: ts,
          bookings: bs.rows,
          policy: await service.policy(),
          role: actor.role,
          ...(actor.role === "admin"
            ? {
                buses: (await d.query("SELECT data FROM buses")).rows.map(
                  (r) => r.data,
                ),
                routes: (await d.query("SELECT data FROM routes")).rows.map(
                  (r) => r.data,
                ),
                audit: (
                  await d.query("SELECT * FROM audit ORDER BY id DESC LIMIT 30")
                ).rows,
              }
            : {}),
        });
      }
      if (p[1] === "booking" && p[2] && req.method === "GET") {
        return json(await service.booking(p[2], undefined, true));
      }
      await staffSession(true);
      if (p[1] === "cancel") {
        await service.cancel(z.string().uuid().parse(body.id), actor.id, true);
        return json({ ok: true });
      }
      if (p[1] === "policy") {
        const d = z
          .object({
            cutoffMinutes: z.number().int().min(0).max(1440),
            cancellationMinutes: z.number().int().min(0).max(1440),
            holdMinutes: z.number().int().min(1).max(15),
            bagKg: z.number().int().min(0).max(50),
            arrivalMinutes: z.number().int().min(0).max(180),
          })
          .parse(body);
        await transaction(async (tx) => {
          await tx.query(`UPDATE settings SET value=$1 WHERE key='policy'`, [
            JSON.stringify(d),
          ]);
          await service.audit(tx, actor.id, "policy.updated", d);
        });
        return json({ ok: true });
      }
      if (p[1] === "seed") {
        await service.refreshSeed();
        return json({ ok: true });
      }
      if (p[1] === "block") {
        const data = z
          .object({
            tripId: z.string(),
            seat: z.number().int().positive(),
            blocked: z.boolean(),
          })
          .parse(body);
        await transaction(async (tx) => {
          const result = await tx.query(
            `UPDATE inventory SET blocked=$3 WHERE trip_id=$1 AND seat=$2 AND booking_id IS NULL AND (hold_expires IS NULL OR hold_expires<NOW()) RETURNING seat`,
            [data.tripId, data.seat, data.blocked],
          );
          if (!result.rows.length)
            throw new service.Fault(
              "That seat is booked, held, or does not exist.",
              409,
            );
          await service.audit(tx, actor.id, "seat.blocked", data);
        });
        return json({ ok: true });
      }
      if (p[1] === "trip") {
        const data = z
          .object({
            id: z.string().optional(),
            routeId: z.string(),
            busId: z.string(),
            departure: z.iso.datetime({ offset: true }),
            arrival: z.iso.datetime({ offset: true }),
            fare: z.number().int().min(0),
            fee: z.number().int().min(0),
            status: z.enum(["open", "closed", "cancelled"]),
          })
          .parse(body);
        if (new Date(data.arrival) <= new Date(data.departure))
          throw new service.Fault("Arrival must be after departure.");
        await transaction(async (tx) => {
          const bus = (
            await tx.query<{ data: Bus }>(
              "SELECT data FROM buses WHERE id=$1",
              [data.busId],
            )
          ).rows[0];
          if (
            !bus ||
            !(
              await tx.query("SELECT id FROM routes WHERE id=$1", [
                data.routeId,
              ])
            ).rows.length
          )
            throw new service.Fault("Choose a valid route and bus.");
          const id = data.id || `demo-${randomUUID()}`;
          const old = (
            await tx.query<{ bus_id: string }>(
              "SELECT bus_id FROM trips WHERE id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0];
          const sold = (
            await tx.query(
              `SELECT id FROM bookings WHERE trip_id=$1 AND status='confirmed'`,
              [id],
            )
          ).rows.length;
          if (sold)
            throw new service.Fault(
              "Cancel confirmed bookings before editing this departure.",
              409,
            );
          await tx.query(
            `INSERT INTO trips VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET route_id=$2,bus_id=$3,departure=$4,arrival=$5,fare=$6,fee=$7,status=$8`,
            [
              id,
              data.routeId,
              data.busId,
              data.departure,
              data.arrival,
              data.fare,
              data.fee,
              data.status,
            ],
          );
          await tx.query("DELETE FROM inventory WHERE trip_id=$1", [id]);
          await tx.query(
            "INSERT INTO inventory(trip_id,seat) SELECT $1,generate_series(1,$2::int)",
            [id, bus.data.capacity],
          );
          await service.audit(tx, actor.id, "trip.saved", { id });
        });
        return json({ ok: true });
      }
      if (p[1] === "reset") {
        if (body.confirm !== "RESET DEMO BOOKINGS")
          throw new service.Fault("Enter RESET DEMO BOOKINGS to reset.");
        await transaction(async (tx) => {
          await tx.query(
            "UPDATE inventory SET booking_id=NULL,hold_id=NULL,owner_hash=NULL,hold_expires=NULL",
          );
          await tx.query("DELETE FROM tickets");
          await tx.query("DELETE FROM bookings");
          await service.audit(tx, actor.id, "demo.bookings_reset", {});
        });
        return json({ ok: true });
      }
      if (p[1] === "bus") {
        const data = z
          .object({
            id: z.string().min(1).max(80),
            name: z.string().min(2).max(100),
            registration: z.string().min(2).max(40),
            capacity: z.union([z.literal(49), z.literal(51), z.literal(53)]),
            amenities: z.array(z.string().max(60)).max(10),
            layout: z.array(z.array(z.number().int().min(0).max(53))),
          })
          .parse(body);
        const nums = data.layout.flat().filter(Boolean);
        if (
          new Set(nums).size !== data.capacity ||
          nums.length !== data.capacity ||
          Math.max(...nums) !== data.capacity
        )
          throw new service.Fault("Layout must contain each seat number once.");
        await transaction(async (tx) => {
          if (
            (await tx.query("SELECT id FROM trips WHERE bus_id=$1", [data.id]))
              .rows.length
          )
            throw new service.Fault(
              "Create a new bus template instead of changing one assigned to trips.",
              409,
            );
          await tx.query(
            "INSERT INTO buses VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2",
            [data.id, JSON.stringify(data)],
          );
          await service.audit(tx, actor.id, "bus.saved", { id: data.id });
        });
        return json({ ok: true });
      }
      if (p[1] === "route") {
        const data = z
          .object({
            id: z.string().min(1).max(80),
            name: z.string().min(2).max(100),
            origin: z.string().min(2),
            destination: z.string().min(2),
            via: z.string(),
            stops: z
              .array(
                z.object({
                  name: z.string().min(2),
                  offset: z.number().int().min(0),
                  location: z.string().min(2),
                }),
              )
              .min(2)
              .max(50),
            duration: z.number().int().positive(),
            departure: z.string(),
            fare: z.number().int().min(0),
            busId: z.string(),
            source: z.string(),
          })
          .parse(body);
        if (
          data.stops.some((s, i) => i && s.offset <= data.stops[i - 1].offset)
        )
          throw new service.Fault("Stops must have increasing time offsets.");
        if (
          data.stops[0].name !== data.origin ||
          data.stops.at(-1)!.name !== data.destination
        )
          throw new service.Fault("Endpoints must match first and last stops.");
        await transaction(async (tx) => {
          if (
            (
              await tx.query("SELECT id FROM trips WHERE route_id=$1", [
                data.id,
              ])
            ).rows.length
          )
            throw new service.Fault(
              "Create a new route variant instead of changing an assigned route.",
              409,
            );
          await tx.query(
            "INSERT INTO routes VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2",
            [data.id, JSON.stringify(data)],
          );
          await service.audit(tx, actor.id, "route.saved", { id: data.id });
        });
        return json({ ok: true });
      }
    }
    throw new service.Fault("Endpoint not found.", 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    if (e instanceof service.Fault)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(
      "Request failed:",
      e instanceof Error ? e.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
export { handler as GET, handler as POST, handler as DELETE };
