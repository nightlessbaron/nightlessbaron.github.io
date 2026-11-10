# What R3 routing costs on the wire, for one trajectory of K2-Horizon-375B-A23B.
#
# The body imitates a merged sample: token IDs, rollout log-probs, loss mask, and the routed
# expert IDs as base64, which is how SGLang returns them. Only 58 of the model's 61 layers are MoE
# (config.json: mlp_only_layers [0, 1, 2]), but RL360 reshapes routing as (tokens - 1, num_layers,
# topk) and checks the byte length against all 61, so the wire carries 61 rows of 8 int32 IDs.
#
# Paths timed, as they run in RL360 at commit 9a9522a:
#   session server  /merged returns a pydantic model through FastAPI's default JSONResponse,
#                   i.e. stdlib json.dumps(ensure_ascii=False, separators=(",", ":"))
#   rollout manager httpx response.json(), i.e. stdlib json.loads, on its event loop
#   per agent turn  the session server parses SGLang's body with orjson.loads; the agent's
#                   client parses the same body again with stdlib json
# orjson and pybase64 are pinned in RL360's requirements (orjson 3.11.8, pybase64 1.4.3).
#
# Run: python r3_bench.py [tokens]   (single-threaded; 2 warm-up runs, then 10 timed)
import json, platform, statistics as st, sys, time
import numpy as np, orjson, pybase64

T = int(sys.argv[1]) if len(sys.argv) > 1 else 58_000
LAYERS, TOPK, EXPERTS, POLICY_FRAC = 61, 8, 192, 0.5
rng = np.random.default_rng(0)
ids = rng.integers(0, EXPERTS, size=(T - 1, LAYERS, TOPK), dtype=np.int32)  # (tokens - 1) rows
n_policy = int(T * POLICY_FRAC)
body_obj = {"session_id": "s" * 32, "sample": {
    "tokens": rng.integers(0, 160_000, size=T).tolist(),
    "loss_mask": [1] * n_policy + [0] * (T - n_policy),
    "rollout_log_probs": (-rng.exponential(0.3, size=n_policy)).tolist(),
    "rollout_routed_experts": pybase64.b64encode(ids.tobytes()).decode("ascii"),
}, "metadata": {}}

def timed(fn, warm=2, reps=10):
    for _ in range(warm): fn()
    ts = []
    for _ in range(reps):
        t0 = time.perf_counter(); fn(); ts.append(time.perf_counter() - t0)
    return st.median(ts), min(ts), max(ts)

stdlib_dumps = lambda: json.dumps(body_obj, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
body = stdlib_dumps()
routing = len(body_obj["sample"]["rollout_routed_experts"])
MB = 1e6
print(f"{platform.processor() or platform.machine()} | python {platform.python_version()} | orjson {orjson.__version__} | {T:,} tokens")
print(f"body {len(body)/MB:.1f} MB, of which routing {routing/MB:.1f} MB; "
      f"same IDs as uint8 binary: {ids.size/MB:.1f} MB ({len(body)/ids.size:.1f}x smaller than the body)")
print(f"{'path':44s} {'median':>9s} {'min-max':>15s} {'MB/s':>7s}")
for name, fn in [("server: stdlib json.dumps (FastAPI default)", stdlib_dumps),
                 ("server: orjson.dumps", lambda: orjson.dumps(body_obj)),
                 ("client: stdlib json.loads (httpx .json())", lambda: json.loads(body)),
                 ("client: orjson.loads", lambda: orjson.loads(body))]:
    med, lo, hi = timed(fn)
    print(f"{name:44s} {med*1e3:7.0f}ms {lo*1e3:6.0f}-{hi*1e3:<6.0f}ms {len(body)/MB/med:7.0f}")
