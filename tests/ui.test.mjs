// Local DOM simulation only: no browser, external resource loading or network requests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
test("main learning interactions operate on the actual HTML and app module", async (t) => {
  const window = new Window({
    url: "https://happyyharry1209-oss.github.io/sequence-lab/",
    settings: {
      enableJavaScriptEvaluation: false,
      disableJavaScriptFileLoading: true,
      enableCSSFileLoading: false,
      enableImageFileLoading: false,
      navigation: {
        disableMainFrameNavigation: true,
        disableChildFrameNavigation: true,
        disableChildPageNavigation: true,
      },
    },
  });
  window.document.write(
    await readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
  );
  Object.assign(globalThis, {
    window,
    document: window.document,
    location: window.location,
    localStorage: window.localStorage,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network disabled in DOM simulation");
  };
  const $ = (s) => document.querySelector(s),
    input = (id, value) => {
      $(id).value = value;
      $(id).dispatchEvent(new window.Event("input", { bubbles: true }));
    };
  await import("../docs/app.js");
  await t.test("initial arithmetic calculation and full data table", () => {
    assert.equal($("#nth").textContent, "47");
    assert.equal($("#sum").textContent, "300");
    assert.equal($("#terms-table").children.length, 12);
    assert.ok($("#chart svg"));
    input("#d", "-3");
    assert.equal($("#nth").textContent, "-30");
  });
  await t.test(
    "switch types, r=1 special case and invalid count preserves previous result",
    () => {
      $('[data-type="geometric"]').click();
      input("#r", "1");
      assert.equal($("#nth").textContent, "2");
      assert.equal($("#sum").textContent, "24");
      assert.match($("#sum-formula").textContent, /r = 1/);
      input("#n-number", "0");
      assert.ok($("#lab-error").textContent);
      assert.equal($("#play").disabled, true);
      assert.equal($("#sum").textContent, "24");
      input("#n-number", "4");
      assert.equal($("#sum").textContent, "8");
      assert.equal($("#play").disabled, false);
      $('[data-type="recurrence"]').click();
      assert.match($("#change-label").textContent, /平衡點/);
      assert.equal($("#change").textContent, "25");
    },
  );
  await t.test(
    "detective produces evidence and candidate; rejects HTML as numeric input",
    () => {
      $("#detective-input").value = "1,4,9,16,25";
      $("#detect").click();
      assert.match($("#detective-results").textContent, /二次數列/);
      assert.match($("#detective-results").textContent, /36/);
      $("#detective-input").value = "1,2,<img src=x>,4";
      $("#detect").click();
      assert.ok($("#detective-error").textContent);
      assert.equal($("#detective-results img"), null);
    },
  );
  await t.test(
    "folding distinguishes number of folds from sequence index",
    () => {
      $('[data-scenario="1"]').click();
      assert.match($("#scenario-result").textContent, /409.6/);
      input('#scenario-form [name="folds"]', "0");
      assert.match($("#scenario-result").textContent, /0.1/);
    },
  );
  await t.test(
    "quiz feedback scores each question once and hints are available",
    () => {
      $("#show-hint").click();
      assert.equal($("#quiz-hint").hidden, false);
      $("#quiz-answer").value = "-999";
      $("#quiz-form").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      assert.match($("#quiz-feedback").textContent, /正確答案/);
      assert.equal($("#quiz-done").textContent, "1 題");
      $("#quiz-form").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      assert.equal($("#quiz-done").textContent, "1 題");
      $("#next-question").click();
      assert.equal($("#quiz-answer").value, "");
      assert.equal($("#quiz-hint").hidden, true);
    },
  );
  await t.test(
    "offline guidance is labelled honestly and uses text-only output",
    () => {
      $('[data-prompt="why"]').click();
      assert.match($("#chat-log").textContent, /本機導學.*非 AI/);
      assert.match($("#chat-log").textContent, /n−1/);
      $("#chat-input").value = "<script>alert(1)</script>";
      $("#chat-form").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      assert.match($("#chat-log").textContent, /尚未設定 AI 後端/);
      assert.equal($("#chat-log script"), null);
    },
  );
  await t.test(
    "all navigation destinations exist and view changes follow hash",
    () => {
      for (const name of [
        "explore",
        "detective",
        "applications",
        "practice",
        "notes",
        "tutor",
      ]) {
        window.location.hash = name;
        window.dispatchEvent(new window.HashChangeEvent("hashchange"));
        assert.equal($(`#view-${name}`).hidden, false);
        assert.equal(
          document.querySelectorAll(".view:not([hidden])").length,
          1,
        );
      }
    },
  );
  globalThis.fetch = originalFetch;
  await window.happyDOM.abort();
});
