/*
# Create delivery tracking data model

1. New tables
- `shipments`: one record per vehicle or colis being tracked, with its public tracking code, customer details, route, and current status.
- `shipment_events`: the manually managed timeline attached to each shipment, including the event label, location, description, and completion time.

2. Security
- Row level security is enabled on both tables.
- This is a single-tenant internal tracker without sign-in in this first version, so the anon and authenticated roles can manage the shared workspace.
- Separate policies are created for select, insert, update, and delete operations on both tables.

3. Important notes
- Tracking codes are unique and indexed for fast public lookups.
- Deleting a shipment also removes its timeline events through the foreign key cascade.
- Timestamps are set by the database when not supplied.
*/

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL UNIQUE,
  reference text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  vehicle_label text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  current_status text NOT NULL DEFAULT 'En préparation',
  eta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  title text NOT NULL,
  location text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_tracking_code_idx ON public.shipments (tracking_code);
CREATE INDEX IF NOT EXISTS shipment_events_shipment_id_idx ON public.shipment_events (shipment_id, occurred_at);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_events TO anon, authenticated;

DROP POLICY IF EXISTS "Shared users can read shipments" ON public.shipments;
CREATE POLICY "Shared users can read shipments" ON public.shipments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Shared users can create shipments" ON public.shipments;
CREATE POLICY "Shared users can create shipments" ON public.shipments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can update shipments" ON public.shipments;
CREATE POLICY "Shared users can update shipments" ON public.shipments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can delete shipments" ON public.shipments;
CREATE POLICY "Shared users can delete shipments" ON public.shipments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Shared users can read shipment events" ON public.shipment_events;
CREATE POLICY "Shared users can read shipment events" ON public.shipment_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Shared users can create shipment events" ON public.shipment_events;
CREATE POLICY "Shared users can create shipment events" ON public.shipment_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can update shipment events" ON public.shipment_events;
CREATE POLICY "Shared users can update shipment events" ON public.shipment_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Shared users can delete shipment events" ON public.shipment_events;
CREATE POLICY "Shared users can delete shipment events" ON public.shipment_events FOR DELETE TO anon, authenticated USING (true);
