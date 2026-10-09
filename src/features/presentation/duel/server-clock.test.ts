import { ServerClock } from "./server-clock";

describe("ServerClock", () => {
  it("assumes the server stamped its reply halfway through the trip", () => {
    const clock = new ServerClock();
    // Our clock reads 1000 when the server reads 6050, over a 100 ms trip.
    clock.observe(6050, 1000, 1100);
    // A server moment 6060 is 10 ms after the midpoint, which was our 1050.
    expect(clock.toLocal(6060, 1050, 500)).toBe(510);
  });

  it("trusts the quickest trip over a slow one", () => {
    const clock = new ServerClock();
    clock.observe(6050, 1000, 1100);
    clock.observe(9000, 2000, 3000);
    expect(clock.toLocal(6060, 1050, 500)).toBe(510);
  });

  it("is unknown until the first reading", () => {
    const clock = new ServerClock();
    expect(clock.known).toBe(false);
    clock.observe(1, 0, 0);
    expect(clock.known).toBe(true);
  });
});
