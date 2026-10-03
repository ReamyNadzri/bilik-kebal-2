import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import { SupabaseWantedRepository } from "./supabase-wanted-repository";

const rpc = vi.fn();
const from = vi.fn();
const repository = () =>
  new SupabaseWantedRepository({ rpc, from } as unknown as SupabaseClient<Database>);

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

test("reads the map totals in one database call, for the chosen university", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        id: "c1",
        name: "Shah Alam",
        region_open: true,
        latitude: "3.06900",
        longitude: "101.50000",
        map_x: "40.00",
        map_y: null,
        open_wanted_count: 3,
        open_bounty_sen: "4500",
      },
    ],
    error: null,
  });

  const regions = await repository().listCampusRegions("inst-1");

  expect(rpc).toHaveBeenCalledExactlyOnceWith("campus_region_totals", {
    target_institution_id: "inst-1",
  });
  expect(from).not.toHaveBeenCalled();
  expect(regions).toEqual([
    {
      id: "c1",
      name: "Shah Alam",
      regionOpen: true,
      latitude: 3.069,
      longitude: 101.5,
      mapX: 40,
      mapY: null,
      openWantedCount: 3,
      openBountySen: 4500,
    },
  ]);
});
