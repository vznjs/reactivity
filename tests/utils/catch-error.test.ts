// Ported from Solid core's `catchError` suite
// (solidjs/solid · packages/solid/test/signals.spec.ts) to verify VZN's error
// routing matches Solid's, including the hard cases (a boundary catching an error
// thrown later, on an async update, by an effect/memo created within it).
//
// Adaptations for VZN:
//   * `createRoot` → `root`, `createEffect` → `effect`, `createSignal` → `signal`,
//     `createMemo` → `computed`.
//   * VZN schedules updates on a microtask, so signal writes that must settle before
//     an assertion are wrapped in `flushSync(...)` (Solid flushes within its root).
//   * VZN memos are lazy, so a ported "in nested memo" reads the memo to force it.
import { describe, it, vi, expect } from "vite-plus/test";
import { signal, computed, effect, root, catchError, onCleanup, flushSync } from "../../src/index";

describe("catchError (ported from Solid)", () => {
  it("No Handler — rethrows", () => {
    expect(() =>
      root(() => {
        throw "fail";
      }),
    ).toThrow("fail");
  });

  it("Top level", () => {
    let errored = false;
    expect(() =>
      root(() => {
        catchError(
          () => {
            throw "fail";
          },
          () => (errored = true),
        );
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("Nested in catchError — inner rethrow bubbles to outer", () => {
    let errored = false;
    expect(() =>
      root(() => {
        catchError(
          () => {
            catchError(
              () => {
                throw "fail";
              },
              (error) => {
                throw error;
              },
            );
          },
          () => (errored = true),
        );
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("In initial effect", () => {
    let errored = false;
    expect(() =>
      root(() => {
        effect(() => {
          catchError(
            () => {
              throw "fail";
            },
            () => (errored = true),
          );
        });
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("In update effect", () => {
    let errored = false;
    expect(() =>
      root(() => {
        const s = signal(0);
        effect(() => {
          const v = s();
          catchError(
            () => {
              if (v) throw "fail";
            },
            () => (errored = true),
          );
        });
        flushSync(() => s(1));
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("In initial nested effect", () => {
    let errored = false;
    expect(() =>
      root(() => {
        effect(() => {
          effect(() => {
            catchError(
              () => {
                throw "fail";
              },
              () => (errored = true),
            );
          });
        });
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("In nested update effect", () => {
    let errored = false;
    expect(() =>
      root(() => {
        const s = signal(0);
        effect(() => {
          effect(() => {
            const v = s();
            catchError(
              () => {
                if (v) throw "fail";
              },
              () => (errored = true),
            );
          });
        });
        flushSync(() => s(1));
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  // The hard case: the boundary is established when the inner effect is *created*,
  // but the throw happens on a later async update. VZN catches it because the handler
  // rides the inner effect's eagerly-inherited context.
  it("In nested update effect, different levels", () => {
    let errored = false;
    expect(() =>
      root(() => {
        const s = signal(0);
        effect(() => {
          catchError(
            () =>
              effect(() => {
                const v = s();
                if (v) throw "fail";
              }),
            () => (errored = true),
          );
        });
        flushSync(() => s(1));
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("In nested memo (lazy — forced by a read)", () => {
    let errored = false;
    expect(() =>
      root(() => {
        const m = computed(() => {
          catchError(
            () => {
              effect(() => {});
              throw new Error("fail");
            },
            () => (errored = true),
          );
        });
        m(); // VZN memos are lazy — force evaluation
      }),
    ).not.toThrow();
    expect(errored).toBe(true);
  });

  it("returns fn's value when nothing throws, undefined when it does", () => {
    root(() => {
      expect(
        catchError(
          () => 42,
          () => {},
        ),
      ).toBe(42);
      expect(
        catchError(
          () => {
            throw "x";
          },
          () => {},
        ),
      ).toBe(undefined);
    });
  });
});

describe("catchError (VZN behavior)", () => {
  it("runs the failing computation's cleanups before the handler", () => {
    const order: string[] = [];
    root(() => {
      catchError(
        () => {
          effect(() => {
            onCleanup(() => order.push("cleanup"));
            throw new Error("boom");
          });
        },
        () => order.push("handler"),
      );
    });
    expect(order).toEqual(["cleanup", "handler"]);
  });

  it("routes a throw from a computed read inside an effect", () => {
    const handler = vi.fn();
    root(() => {
      catchError(() => {
        const c = computed(() => {
          throw new Error("from-memo");
        });
        effect(() => {
          c();
        });
      }, handler);
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]![0] as Error).message).toBe("from-memo");
  });

  it("one failing effect does not stop a sibling", () => {
    const handler = vi.fn();
    const ran: string[] = [];
    root(() => {
      catchError(() => {
        effect(() => {
          ran.push("a");
          throw new Error("a-fails");
        });
        effect(() => {
          ran.push("b");
        });
      }, handler);
    });
    expect(ran).toEqual(["a", "b"]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs the handler untracked — its reads don't resubscribe it", async () => {
    const s = signal(0);
    const handler = vi.fn(() => {
      s(); // a read inside the handler must NOT subscribe anything
    });
    root(() => {
      catchError(() => {
        effect(() => {
          throw new Error("boom");
        });
      }, handler);
    });
    expect(handler).toHaveBeenCalledTimes(1);
    s(1);
    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1); // not re-invoked by the signal change
  });

  // Solid PR #1530 (exelord): handlers always receive a real Error, raw value as cause.
  it("normalizes a thrown string into an Error, preserving the original as cause", () => {
    let received: Error | undefined;
    root(() => {
      catchError(
        () => {
          throw "plain string";
        },
        (e) => (received = e),
      );
    });
    expect(received).toBeInstanceOf(Error);
    expect(received!.message).toBe("plain string");
    expect(received!.cause).toBe("plain string");
  });

  it("normalizes a thrown non-string into an Error with the value as cause", () => {
    let received: Error | undefined;
    const thrown = { code: 42 };
    root(() => {
      catchError(
        () => {
          throw thrown;
        },
        (e) => (received = e),
      );
    });
    expect(received).toBeInstanceOf(Error);
    expect(received!.cause).toBe(thrown);
  });

  // Solid PR #1774 (exelord), async variant: an inner handler that rethrows on a
  // later async re-run still bubbles to the outer boundary.
  it("an inner handler rethrowing on an async update bubbles to the outer boundary", async () => {
    const s = signal(0);
    const outer = vi.fn();
    root(() => {
      catchError(() => {
        catchError(
          () => {
            effect(() => {
              if (s() === 1) throw new Error("late");
            });
          },
          (e) => {
            throw e; // inner rethrows
          },
        );
      }, outer);
    });
    expect(outer).not.toHaveBeenCalled();
    s(1);
    await Promise.resolve();
    expect(outer).toHaveBeenCalledTimes(1);
    expect((outer.mock.calls[0]![0] as Error).message).toBe("late");
  });

  it("supports an error-boundary that swaps in a fallback", async () => {
    const failing = signal(false);
    const error = signal<unknown>(undefined);
    const view: string[] = [];

    root(() => {
      effect(() => {
        if (error() !== undefined) {
          view.push("fallback");
          return;
        }
        catchError(
          () => {
            effect(() => {
              if (failing()) throw new Error("render-failed");
              view.push("content");
            });
          },
          (e) => error(e),
        );
      });
    });

    expect(view).toEqual(["content"]);
    failing(true);
    await Promise.resolve(); // inner effect re-runs, throws, handler sets error()
    await Promise.resolve(); // error() change re-runs the boundary → fallback
    expect(view).toEqual(["content", "fallback"]);
  });
});
