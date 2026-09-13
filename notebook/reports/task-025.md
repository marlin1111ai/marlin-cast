# Task 025 — GHCR publishing workflow, VERSION, D025 (2026-09-13)

Date: 2026-09-13 07:30–07:40 EDT (11:30–11:40Z). Host: marlinpc. Nothing on
192.168.1.250 was contacted; `backups/`, `data/`, `/tmp/mc-test`, the live
Chrome (still quit), `Dockerfile` and `docker/entrypoint.sh` were not touched.
`/Apps/marlin-iptv-editor` was read only. No host installs. No credentials or
tokens anywhere: the workflow authenticates with the run's own `GITHUB_TOKEN`.

**Result: steps 1–3 done; V1 passes; V2 and V3 are the owner's step** (`gh`
is not installed on marlinpc and the repository is private, so neither the
Actions run nor a GHCR pull can be observed from here — see V2/V3 below for
the probe that was run).

---

## Result per step

| Step | Result |
|---|---|
| 1 workflow | done — `.github/workflows/docker.yml`: push to `main` (with the reference's `paths-ignore`) and push of a tag `v*`, plus `workflow_dispatch`; `permissions: contents: read, packages: write`; `docker/login-action@v3` with `GITHUB_TOKEN`; `docker/setup-buildx-action@v3`; `docker/build-push-action@v6`, `linux/amd64`, `cache-from/cache-to: type=gha`; tags `latest` + `sha-<short>` on `main`, `<VERSION>` on a `v*` tag |
| 2 VERSION | done — the reference convention **does** use a repo-root `VERSION` file (iptv-editor is at `1.9.0`); `VERSION` created with `0.1.0` |
| 3 notebook | done — D025 (image name, tag scheme, trigger, release procedure, visibility as the owner's step); SESSION-STATE record |

### Files touched

| File | Step |
|---|---|
| `.github/workflows/docker.yml` | 1 (new) |
| `VERSION` | 2 (new, `0.1.0`) |
| `notebook/DECISIONS.md` | 3 (D025) |
| `notebook/SESSION-STATE.md` | 3 |
| `notebook/reports/task-025.md` | report |

### Design notes (where this departs from the reference, and why)

- **Tag trigger.** The reference publishes only from `main`; the task adds
  `tags: ["v*"]`. `paths-ignore` applies to the branch filter only, which is
  the intended behaviour.
- **Tag list is gated on the ref.** `main` → `latest` + `sha-<short>`;
  `v*` → `<VERSION>` only. The reference's `v<run_number>` tag is dropped so
  `v*` cannot be confused with a run number.
- **Version tag check runs on tag pushes only** and adds one rule to the
  reference's immutability check: the git tag stripped of `v` must equal
  `VERSION`, otherwise the run fails before anything is pushed. On a `main`
  push the step is skipped, so `latest` is never blocked by an existing
  version tag.
- **No build-args.** The reference passes `GIT_SHA`, `BUILD_NUMBER`,
  `APP_VERSION` into `ARG`s its Dockerfile declares; ours declares none
  (D024, Dockerfile unchanged this pass), and unconsumed build-args only
  produce a warning, so they are omitted.
- **buildx cache** (`type=gha`, `mode=max`) is new; the reference has none.
  The Chrome deb and the apt layers are the slow part and cache well; the
  `npm ci` and `COPY src` layers re-run on code changes as they should.
- **`workflow_dispatch` from a ref other than `main`** enables no tag and
  would fail at the build step. Dispatch from `main` publishes `latest`.

---

## V1 — structure against the reference

Both files parse (PyYAML). Trigger set, permissions, and the step skeleton:

| | reference `publish-image.yml` | `docker.yml` |
|---|---|---|
| triggers | push (main, paths-ignore), workflow_dispatch | push (main, paths-ignore, **tags v\***), workflow_dispatch |
| permissions | contents: read, packages: write | same |
| steps | Checkout, Log in to GHCR, Read app version, Refuse to overwrite an existing version tag, Compute image metadata, Compute short SHA, Build and push | Checkout, Log in to GHCR, Read app version, Check the version tag (tag pushes only), Compute image metadata, **Set up buildx**, Build and push |
| actions | checkout@v4, login-action@v3, metadata-action@v5, build-push-action@v6 | same + setup-buildx-action@v3 |

`diff -u` reference → ours (110 lines; whitespace and comment lines included):

```diff
-    # D030 (Task 091): notebook-, design-, and markdown-only pushes do not
-    ...
+    # Notebook- and markdown-only pushes do not publish an image (reference
+    # convention). A push is skipped only if EVERY changed file matches.
     paths-ignore:
       - "notebook/**"
-      - "design/**"
       - "**/*.md"
       - "*.md"
       - ".gitignore"
+    tags: ["v*"]
   workflow_dispatch: {}
 ...
+env:
+  IMAGE: ghcr.io/marlin1111ai/marlin-cast
 ...
-      - name: Refuse to overwrite an existing version tag
+      - name: Check the version tag (tag pushes only)
+        if: startsWith(github.ref, 'refs/tags/v')
         env:
-          IMAGE_TAG: ghcr.io/marlin1111ai/iptv-editor:${{ steps.appver.outputs.value }}
+          GIT_TAG: ${{ github.ref_name }}
+          APP_VERSION: ${{ steps.appver.outputs.value }}
         run: |
+          if [ "${GIT_TAG#v}" != "$APP_VERSION" ]; then
+            echo "::error title=Tag does not match VERSION::..."
+            exit 1
+          fi
+          IMAGE_TAG="$IMAGE:$APP_VERSION"
           if out=$(docker manifest inspect "$IMAGE_TAG" 2>&1); then
   (immutability case statement identical apart from the decision number)
 ...
-          images: ghcr.io/marlin1111ai/iptv-editor
+          images: ${{ env.IMAGE }}
           tags: |
-            type=raw,value=latest
-            type=sha,prefix=sha-,format=short
-            type=raw,value=v${{ github.run_number }}
-            type=raw,value=${{ steps.appver.outputs.value }}
-
-      - name: Compute short SHA
-        id: sha
-        run: echo "short=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
+            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
+            type=sha,prefix=sha-,format=short,enable=${{ github.ref == 'refs/heads/main' }}
+            type=raw,value=${{ steps.appver.outputs.value }},enable=${{ startsWith(github.ref, 'refs/tags/v') }}
+
+      - name: Set up buildx
+        uses: docker/setup-buildx-action@v3
 ...
-          build-args: |
-            GIT_SHA=${{ steps.sha.outputs.short }}
-            BUILD_NUMBER=${{ github.run_number }}
-            APP_VERSION=${{ steps.appver.outputs.value }}
+          cache-from: type=gha
+          cache-to: type=gha,mode=max
```

Not run: `act` (not required, not installed). The workflow's first real
execution is the push below.

## V2 — the Actions run

- `gh` is not installed on marlinpc (`which gh` empty). No host installs.
- The repository is private: `GET api.github.com/repos/marlin1111ai/marlin-cast`
  answers `404` unauthenticated, so the Actions API cannot be polled either.
  The only credential here is the SSH deploy key used for `git push`, which
  does not reach the API.

**The run result is the owner's step:** after this push, open
github.com/marlin1111ai/marlin-cast/actions → "Publish image". Note that this
push changes `.github/workflows/docker.yml` and `VERSION` alongside notebook
files, so the `paths-ignore` rule does **not** skip it — the workflow runs on
this very commit. Expected on success: `ghcr.io/marlin1111ai/marlin-cast:latest`
and `:sha-<7-char SHA of this commit>`. The build fetches the pinned Chrome
deb from dl.google.com on the runner (recon item A/H); if Google has pruned
that URL the run fails at the Chrome layer with the Dockerfile's own message.

## V3 — pull

Not possible from marlinpc until the package is public: a new GHCR package
inherits the repository's private visibility, and there is no registry token
here. The probe run after the push (see "Pushed") records what the registry
answered. **Owner's steps, in order:** confirm the run succeeded; in GitHub →
Packages → `marlin-cast` → Package settings → Change visibility → Public
(the reference did the same for iptv-editor, its D022 addendum); then on any
Docker host:

```
docker pull ghcr.io/marlin1111ai/marlin-cast:latest
docker run --rm --entrypoint google-chrome ghcr.io/marlin1111ai/marlin-cast:latest --version
```

(`--entrypoint` is needed: the image's entrypoint is tini + the container
entrypoint, which refuses to start without `VNC_PASSWORD`.) Expected:
`Google Chrome 153.0.8010.36`.

## Pushed

See the section appended below after the push.

## Least sure of

1. **The tag-gated `enable=` expressions in `metadata-action`.** Standard
   syntax, but not executed here; if a `v*` run produced no tag the
   build-push step would fail loudly with "no tags", not push something wrong.
2. **The `type=gha` cache** on a private repo's first run has nothing to
   restore; the first build is a full one (~5–10 min for the apt + Chrome
   layers).
3. **`docker manifest inspect` on a not-yet-existing package** returns a
   not-found variant the case statement matches; copied from the reference,
   which has run it, but our package name is new.
