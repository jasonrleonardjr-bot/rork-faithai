// Smoke test: 3 simulated users near Portland, OR — expect spot lifecycle.
const URL = "wss://faithai-backend.rork.app/gather";

function ws(userId, name) {
  return new WebSocket(`${URL}?userId=${userId}&name=${encodeURIComponent(name)}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const events = [];
  const alice = ws("u-alice", "Alice");
  const bob = ws("u-bob", "Bob");
  const cara = ws("u-cara", "Cara");
  const far = ws("u-far", "FarAway");

  const states = { alice: [], bob: [], cara: [], far: [] };
  const hooks = [
    [alice, "alice"], [bob, "bob"], [cara, "cara"], [far, "far"],
  ];
  for (const [sock, key] of hooks) {
    sock.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state") states[key].push(msg);
    });
    sock.addEventListener("open", () => console.log(key, "connected"));
  }
  await sleep(2000);

  const near = { lat: 45.5231, lng: -122.6765 };
  const jitter = () => ({ lat: near.lat + (Math.random() - 0.5) * 0.001, lng: near.lng + (Math.random() - 0.5) * 0.001 });
  const sendLoc = (sock, loc) => sock.send(JSON.stringify({ type: "location", ...loc }));

  sendLoc(alice, near);
  sendLoc(far, { lat: 47.6, lng: -122.33 }); // Seattle — far away
  await sleep(1500);

  let s = states.alice.at(-1);
  console.log("STEP1 after 1 nearby user: spots =", s?.spots?.length ?? "?");

  sendLoc(bob, jitter());
  await sleep(2000);
  s = states.alice.at(-1);
  console.log("STEP2 after 2 nearby users: spots =", s?.spots?.length, "members =", s?.members?.length,
    "spot:", s?.spots?.[0] && { name: s.spots[0].name, members: s.spots[0].memberIds.length, selections: s.spots[0].selections.length });

  // Alice selects
  alice.send(JSON.stringify({ type: "select", spotId: s.spots[0].id }));
  await sleep(1500);
  s = states.bob.at(-1);
  console.log("STEP3 after 1 selection: selections =", s?.spots?.[0]?.selections?.length ?? "?");

  // Bob selects -> blue (2+)
  bob.send(JSON.stringify({ type: "select", spotId: s.spots[0].id }));
  await sleep(1500);
  s = states.cara.at(-1);
  console.log("STEP4 after 2 selections: selections =", s?.spots?.[0]?.selections?.length ?? "?");

  // Cara joins the cluster, selects -> 3 selections
  sendLoc(cara, jitter());
  await sleep(1500);
  s = states.cara.at(-1);
  const spot2 = s?.spots?.[0];
  cara.send(JSON.stringify({ type: "select", spotId: spot2.id }));
  await sleep(1500);
  s = states.cara.at(-1);
  console.log("STEP5 after cara joins+selects: members =", s?.spots?.[0]?.memberIds.length, "selections =", s?.spots?.[0]?.selections.length);

  // Everyone stops pinging except far; stale eviction should kill the spot after ~30s+tick
  alice.close(); bob.close(); cara.close();
  console.log("waiting 45s for TTL eviction…");
  await sleep(45_000);
  s = states.far.at(-1);
  console.log("STEP6 after everyone left: spots =", s?.spots?.length, "members =", s?.members?.length);

  alice.close(); bob.close(); cara.close(); far.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
