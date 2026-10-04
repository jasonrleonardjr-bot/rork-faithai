// Smoke test for the shared prayer wall REST API.
const BASE = "https://faithai-backend.rork.app/wall";

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
};

const cast1 = await post("/cast", { userId: "smoke-1", token: "t1", name: "Smoke", text: "Please pray for my interview tomorrow." });
console.log("cast1", cast1.status, JSON.stringify(cast1.data).slice(0, 120));

const cast2 = await post("/cast", { userId: "smoke-2", token: "t2", name: "Quiet", text: "For my mother's health.", anonymous: true });
console.log("cast2", cast2.status, JSON.stringify(cast2.data).slice(0, 120));

const list = await fetch(`${BASE}`).then((r) => r.json() as Promise<{ prayers: Array<Record<string, unknown>> }>);
console.log("list count", list.prayers.length, "no token leak:", list.prayers.every((p) => !("token" in p)));

const id = list.prayers[0].id as string;
const pray = await post("/pray", { userId: "smoke-2", prayerId: id });
console.log("pray", pray.status, JSON.stringify(pray.data));

const prayAgain = await post("/pray", { userId: "smoke-2", prayerId: id });
console.log("pray-toggle", prayAgain.status, JSON.stringify(prayAgain.data));

const answer = await post("/answer", { userId: "smoke-1", token: "t1", prayerId: id, testimony: "It went wonderfully." });
console.log("answer", answer.status, JSON.stringify(answer.data).slice(0, 140));

const foreign = await post("/answer", { userId: "smoke-2", token: "t2", prayerId: id, testimony: "nope" });
console.log("foreign-answer-blocked", foreign.status, JSON.stringify(foreign.data));

const del = await post("/delete", { userId: "smoke-1", token: "t1", prayerId: id });
console.log("delete", del.status, JSON.stringify(del.data));

const flood = await post("/cast", { userId: "smoke-3", token: "t3", text: "x".repeat(600) });
console.log("overlong-cast", flood.status, JSON.stringify(flood.data));
