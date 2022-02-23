// todo(maximsmol): take ideas from https://www.forrestthewoods.com/blog/reverse_engineering_sublime_texts_fuzzy_match/
// todo(maximsmol): take ideas from https://github.com/junegunn/fzf/blob/master/src/algo/algo.go

const prefixLeftoversCost = 4;
const suffixLeftoversCost = 2;

const sim = (a: string, b: string): number => {
  if (a === b) return 16;
  if (a.toLocaleLowerCase().normalize() === b.toLocaleLowerCase().normalize())
    return 15.95;
  return -9999.0;
};

const gapCoefficient = 2;

const print2d = (pattern: string, target: string, xs: number[][]) => {
  let header = "    ";
  for (const x of target) header += x.padStart(3);
  console.log(header);

  let j = 0;
  for (const row of xs) {
    let line = j !== 0 ? pattern[j - 1] : " ";
    for (const x of row) line += x.toString().padStart(3);
    console.log(line);
    ++j;
  }
};

const debug = false;

export const smithWatermanBased = (pattern: string, target: string): number => {
  pattern = pattern.normalize();
  target = target.normalize();

  const n = pattern.length;
  const m = target.length;

  const h: number[][] = [...Array(n + 1)].map(() => Array(m + 1).fill(0.0));

  // Already set by initializing the matrix
  // for (let k = 0; k <= n; ++k) h[k][0] = 0.0;
  // for (let l = 0; l <= m; ++l) h[0][l] = 0.0;

  let maxScore = 0;
  let maxLoc = [0, 0];

  for (let i = 1; i <= n; ++i)
    for (let j = 1; j <= m; ++j) {
      const score = Math.max(
        h[i - 1][j - 1] + sim(pattern[i - 1], target[j - 1]),
        // Never skip anything in the pattern
        // h[i - 1][j] - gapCoefficient,
        h[i][j - 1] - gapCoefficient,
        0
      );

      if (score > maxScore) {
        maxScore = score;
        maxLoc = [i, j];
      }

      h[i][j] = score;
    }

  if (debug) print2d(pattern, target, h);

  let aRes = "";
  let bRes = "";

  let [curI, curJ] = maxLoc;
  // Punish unconsumed pattern suffix
  let sum = -(n - curI) * suffixLeftoversCost;
  while (true) {
    const l = curJ !== 0 ? h[curI][curJ - 1] : 0;
    const u = curI !== 0 ? h[curI - 1][curJ] : 0;
    const d = curI !== 0 && curJ !== 0 ? h[curI - 1][curJ - 1] : 0;

    // Priority: match, target-skip, pattern-skip
    if (d === 0 && u === 0 && l === 0) {
      sum += h[curI][curJ];

      if (debug) {
        aRes = pattern[curI - 1] + aRes;
        bRes = target[curJ - 1] + bRes;
      }

      break;
    }

    if (d >= u && d >= l) {
      sum += h[curI][curJ] - d;

      if (debug) {
        aRes = pattern[curI - 1] + aRes;
        bRes = target[curJ - 1] + bRes;
      }

      --curI;
      --curJ;
    } else if (u >= d && u >= l) {
      sum += h[curI][curJ] - u;

      if (debug) {
        aRes = pattern[curI - 1] + aRes;
        bRes = "X" + bRes;
      }

      --curI;
    } else {
      // todo(maximsmol): should we allow this? seems like in practice it does
      // not ever happen anyway because of how we compute h
      sum += h[curI][curJ] - l;

      if (debug) {
        aRes = "X" + aRes;
        bRes = target[curJ - 1] + bRes;
      }

      --curJ;
    }
  }

  // Punish unconsumed pattern prefix
  sum -= (curI - 1) * prefixLeftoversCost;

  if (debug) {
    console.log(aRes);
    console.log(bRes);
  }
  return Math.max(sum, 0) / 16 / target.length;
};

// For debugging
// const [, , a, b] = process.argv;
// console.log(a, b);
// console.log(smithWatermanBased(a, b));
