const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);
const mainScript = scripts.reduce((a, b) => (a.length >= b.length ? a : b));

function stubEl() {
  return {
    value: "", textContent: "", innerHTML: "", hidden: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    appendChild() {}, replaceChildren() {}, closest: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    focus() {}, setSelectionRange() {}, dispatchEvent() {}, matches: () => false,
    scrollTop: 0, scrollHeight: 0, clientHeight: 0,
  };
}

const context = {
  document: { getElementById: () => stubEl(), documentElement: stubEl(), createElement: () => stubEl(), createDocumentFragment: () => stubEl(), addEventListener() {}, querySelectorAll: () => [] },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), scrollY: 0, scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  console,
  getComputedStyle: () => ({ fontSize: "13px", lineHeight: "18.85px" }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  Event: function () {},
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(mainScript + "\nglobalThis.__prettifySql = prettifySql;", context);

const options = {
  indentSize: 2, keywordCase: "upper",
  alignDeclare: true, alignProcParams: true, alignSelectList: true, alignSetClause: true,
  breakBeforeComma: true, newlineBeforeJoin: true, newlineBeforeAnd: true, spaceAroundOperator: true,
};

function pretty(s) {
  return context.__prettifySql(s, options);
}
function expect(label, output, shouldContain, shouldNotContain) {
  let ok = true;
  const issues = [];
  for (const s of shouldContain || []) {
    if (!output.includes(s)) { ok = false; issues.push("missing: " + JSON.stringify(s)); }
  }
  for (const s of shouldNotContain || []) {
    if (output.includes(s)) { ok = false; issues.push("must NOT contain: " + JSON.stringify(s)); }
  }
  console.log((ok ? "✅" : "❌") + " " + label);
  if (!ok) {
    issues.forEach(i => console.log("   " + i));
    console.log("--- OUTPUT ---\n" + output + "\n---");
  }
}

// 1. DECLARE 꼬리콤마 정렬 (no type padding)
expect(
  "DECLARE trailing-comma single-space",
  pretty(`DECLARE @docHandle INT, @AccUnit INT, @SMIsExecute INT`),
  ["DECLARE @docHandle INT,", "        @AccUnit INT,", "        @SMIsExecute INT"],
  [",@AccUnit", "  ,@", "@docHandle   INT"]
);

// 1b. PROC params leading-comma + 2-space indent
expect(
  "PROC params leading-comma + 2-space",
  pretty(`ALTER PROC dbo.foo
    @a INT,
    @b NVARCHAR(10) = '',
    @c INT = 0
AS
    SELECT 1`),
  ["  @a INT", "  ,@b NVARCHAR(10) = ''", "  ,@c INT = 0"],
  ["     @a", "    ,@b", "@a    INT"]
);

// 2. SELECT 다중 컬럼 꼬리콤마 정렬
expect(
  "SELECT multi-col trailing-comma + aligned",
  pretty(`SELECT @x = 1, @y = 2, @z = 3
FROM dual`),
  ["SELECT @x = 1,", "       @y = 2,", "       @z = 3"],
  ["       ,@y"]
);

// 3. EXEC가 직전 SELECT 코멘트에 먹히지 않음 (회귀)
const r1 = pretty(`IF @@ROWCOUNT = 0 SELECT @KORDecimal = '0' --(mypark 2011.10.24 추가)
EXEC sp_xml_preparedocument @docHandle OUTPUT, @xmlDocument`);
expect(
  "EXEC preserved after comment (regression)",
  r1,
  ["EXEC sp_xml_preparedocument"],
  []
);
// EXEC가 자기 라인에 살아있는지 추가 검증
const execLineSurvives = r1.split("\n").some(l => /^\s*EXEC\b/i.test(l));
console.log((execLineSurvives ? "✅" : "❌") + " EXEC has its own line");

// 4. 빈 줄 없음
const r2 = pretty(`BEGIN

  SELECT 1

  SELECT 2

END`);
const blanks = (r2.match(/\n\s*\n/g) || []).length;
console.log((blanks === 0 ? "✅" : "❌") + ` no blank lines (count=${blanks})`);

// 5. 컬럼 별 trailing comment 가 다음 컬럼 잡아먹지 않음 (회귀)
const r3 = pretty(`SELECT MAX(a) AS InAmt,--입금
CASE WHEN x = 1 THEN a ELSE b END AS OutAmt--출금
FROM t`);
const hasOut = /OutAmt/.test(r3);
const commentSwallowedOut = r3.split("\n").some(l => /--[^\n]*OutAmt/.test(l));
console.log((hasOut && !commentSwallowedOut ? "✅" : "❌") + " OutAmt preserved past trailing comment");

// 6. 중첩 보호 토큰: 라인 주석 안의 [bracket] / 문자열 안의 [bracket]
const r4 = pretty(`SELECT [Col1], --note with [bracket] inside
       x
FROM dbo.[My Table]
WHERE name = '[literal bracket]'`);
const leaks = (r4.match(/__PROTECTED_/g) || []).length;
console.log((leaks === 0 ? "✅" : "❌") + ` no PROTECTED token leak (count=${leaks})`);
if (leaks) console.log("--- OUTPUT ---\n" + r4 + "\n---");

console.log("\n=== Sample 출력 (DECLARE + SELECT) ===");
console.log(pretty(`DECLARE @docHandle INT, @AccUnit INT, @AccDate NVARCHAR(8), @SMAccStd INT,
            @BitCnt INT, @SMIsSet INT, @SMIsExecute INT
SELECT @AccUnit = ISNULL(AccUnit, 0), @AccDate = ISNULL(AccDate, ''), @SMIsSet = ISNULL(SMIsSet, 0)
FROM OPENXML(@docHandle, N'/ROOT/DataBlock1', @xmlFlags)`));
