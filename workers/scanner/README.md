# VAULTIX scanner worker

This is a separately deployed boundary for untrusted claim files. It may read from the private
`quarantine` bucket and invoke an approved scanning engine. It must never be imported by the Next.js
web runtime, and it must only write identifier-only screening results and job acknowledgements.

The adapter in `src/scanner-worker.ts` is provider-neutral. Production wiring still requires an
isolated scanner host and an approved malware/document screening provider before public uploads can
be enabled.
