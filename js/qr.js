// Byte-mode QR encoder (versions 1–10, EC level M). Ported from Alpha's Code Concept build,
// where it was verified module-for-module against the segno reference encoder.
const root = {};
(function (root) {
  'use strict';

  // [ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw]
  var RS_M = {
    1:  [10, 1, 16, 0, 0],
    2:  [16, 1, 28, 0, 0],
    3:  [26, 1, 44, 0, 0],
    4:  [18, 2, 32, 0, 0],
    5:  [24, 2, 43, 0, 0],
    6:  [16, 4, 27, 0, 0],
    7:  [18, 4, 31, 0, 0],
    8:  [22, 2, 38, 2, 39],
    9:  [22, 3, 36, 2, 37],
    10: [26, 4, 43, 1, 44]
  };

  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  // ---- GF(256) ------------------------------------------------------------
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;               // x^8 + x^4 + x^3 + x^2 + 1
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], 1);
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (factor !== 0) {
        for (var j = 0; j < gen.length - 1; j++) res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  // ---- bit stream ---------------------------------------------------------
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (value, length) {
    for (var i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  };

  function utf8Bytes(str) {
    var out = [], enc = encodeURIComponent(str);
    for (var i = 0; i < enc.length; i++) {
      if (enc[i] === '%') { out.push(parseInt(enc.substr(i + 1, 2), 16)); i += 2; }
      else out.push(enc.charCodeAt(i));
    }
    return out;
  }

  // ---- matrix -------------------------------------------------------------
  function newMatrix(size) {
    var m = [], r;
    for (var i = 0; i < size; i++) {
      r = new Array(size);
      for (var j = 0; j < size; j++) r[j] = null;   // null = free module
      m.push(r);
    }
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        var inner = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                    (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m[rr][cc] = inner;
      }
    }
  }

  function placeAlignment(m, version) {
    var pos = ALIGN[version], last = pos.length - 1;
    for (var i = 0; i <= last; i++) {
      for (var j = 0; j <= last; j++) {
        // skip the three corners already occupied by finder patterns
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        var row = pos[i], col = pos[j];
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            m[row + r][col + c] = (Math.max(Math.abs(r), Math.abs(c)) !== 1);
          }
        }
      }
    }
  }

  function reserveFormat(m) {
    var size = m.length, i;
    for (i = 0; i <= 8; i++) {
      if (i !== 6) { m[8][i] = false; m[i][8] = false; }   // index 6 is timing
    }
    for (i = 0; i < 8; i++) { m[8][size - 1 - i] = false; m[size - 1 - i][8] = false; }
    m[size - 8][8] = true;                                   // always-dark module
  }

  function formatBits(mask) {
    // EC level M = 0b00
    var data = (0 << 3) | mask;
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionBits(version) {
    var rem = version << 12;
    for (var i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    return (version << 12) | rem;
  }

  function applyFormat(m, mask) {
    var bitsVal = formatBits(mask), size = m.length, i, bit;
    for (i = 0; i < 15; i++) {
      bit = ((bitsVal >>> i) & 1) === 1;
      // top-left, running around the corner
      if (i < 6)       m[i][8] = bit;
      else if (i === 6) m[7][8] = bit;
      else if (i === 7) m[8][8] = bit;
      else if (i === 8) m[8][7] = bit;
      else              m[8][14 - i] = bit;
      // duplicate copy
      if (i < 8) m[8][size - 1 - i] = bit;
      else       m[size - 15 + i][8] = bit;
    }
    m[size - 8][8] = true;
  }

  function applyVersion(m, version) {
    if (version < 7) return;
    var bitsVal = versionBits(version), size = m.length;
    for (var i = 0; i < 18; i++) {
      var bit = ((bitsVal >>> i) & 1) === 1;
      var a = Math.floor(i / 3), b = i % 3;
      m[size - 11 + b][a] = bit;
      m[a][size - 11 + b] = bit;
    }
  }

  function maskFn(mask, i, j) {
    switch (mask) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7: return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
    }
    return false;
  }

  function penalty(m) {
    var size = m.length, score = 0, i, j, dark = 0;

    function lineScore(get) {
      var s = 0, prev = get(0), len = 1, hist = [];
      for (var k = 1; k < size; k++) {
        var v = get(k);
        if (v === prev) len++;
        else { if (len >= 5) s += 3 + (len - 5); hist.push([prev, len]); prev = v; len = 1; }
      }
      if (len >= 5) s += 3 + (len - 5);
      hist.push([prev, len]);
      // rule 3: 1:1:3:1:1 pattern with 4 modules of light on one side
      var seq = '';
      for (var h = 0; h < hist.length; h++) seq += (hist[h][0] ? '1' : '0').repeat(hist[h][1]);
      var idx = -1;
      while ((idx = seq.indexOf('10111010000', idx + 1)) !== -1) s += 40;
      idx = -1;
      while ((idx = seq.indexOf('00001011101', idx + 1)) !== -1) s += 40;
      return s;
    }

    for (i = 0; i < size; i++) {
      score += lineScore((function (r) { return function (k) { return m[r][k]; }; })(i));
      score += lineScore((function (c) { return function (k) { return m[k][c]; }; })(i));
    }
    for (i = 0; i < size - 1; i++) {
      for (j = 0; j < size - 1; j++) {
        var a = m[i][j];
        if (a === m[i][j + 1] && a === m[i + 1][j] && a === m[i + 1][j + 1]) score += 3;
      }
    }
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (m[i][j]) dark++;
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  /** encode(text) -> { size, modules: boolean[][], version } */
  function encode(text, minVersion, forceMask) {
    var bytes = utf8Bytes(text), version = minVersion || 1, spec, capacity;
    for (; version <= 10; version++) {
      spec = RS_M[version];
      capacity = spec[1] * spec[2] + spec[3] * spec[4];
      var need = 4 + (version < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= capacity * 8) break;
    }
    if (version > 10) throw new Error('qr: payload too large');
    spec = RS_M[version];
    capacity = spec[1] * spec[2] + spec[3] * spec[4];

    var buf = new BitBuf();
    buf.put(4, 4);                                   // byte mode
    buf.put(bytes.length, version < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) buf.put(bytes[i], 8);
    var maxBits = capacity * 8;
    buf.put(0, Math.min(4, maxBits - buf.bits.length));
    while (buf.bits.length % 8 !== 0) buf.bits.push(0);

    var cw = [];
    for (i = 0; i < buf.bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8; k++) b = (b << 1) | buf.bits[i + k];
      cw.push(b);
    }
    var padBytes = [0xec, 0x11], p = 0;
    while (cw.length < capacity) cw.push(padBytes[p++ % 2]);

    // split into blocks, RS-encode, interleave
    var blocks = [], ecBlocks = [], offset = 0, n;
    for (n = 0; n < spec[1]; n++) { blocks.push(cw.slice(offset, offset + spec[2])); offset += spec[2]; }
    for (n = 0; n < spec[3]; n++) { blocks.push(cw.slice(offset, offset + spec[4])); offset += spec[4]; }
    for (n = 0; n < blocks.length; n++) ecBlocks.push(rsEncode(blocks[n], spec[0]));

    var interleaved = [], maxData = Math.max(spec[2], spec[4]);
    for (i = 0; i < maxData; i++) {
      for (n = 0; n < blocks.length; n++) if (i < blocks[n].length) interleaved.push(blocks[n][i]);
    }
    for (i = 0; i < spec[0]; i++) {
      for (n = 0; n < ecBlocks.length; n++) interleaved.push(ecBlocks[n][i]);
    }

    // build the matrix
    var size = version * 4 + 17;
    var m = newMatrix(size);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, size - 7);
    placeFinder(m, size - 7, 0);
    placeAlignment(m, version);
    for (i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; }
    reserveFormat(m);
    if (version >= 7) {
      for (i = 0; i < 6; i++) for (var b2 = 0; b2 < 3; b2++) {
        m[size - 11 + b2][i] = false; m[i][size - 11 + b2] = false;
      }
    }

    // zigzag data placement
    var dataBits = [];
    for (i = 0; i < interleaved.length; i++) {
      for (k = 7; k >= 0; k--) dataBits.push(((interleaved[i] >>> k) & 1) === 1);
    }
    var bitIdx = 0, upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                              // skip vertical timing
      for (var rowStep = 0; rowStep < size; rowStep++) {
        var row = upward ? size - 1 - rowStep : rowStep;
        for (var c2 = 0; c2 < 2; c2++) {
          var cc = col - c2;
          if (m[row][cc] !== null) continue;
          m[row][cc] = bitIdx < dataBits.length ? dataBits[bitIdx] : false;
          bitIdx++;
        }
      }
      upward = !upward;
    }

    // choose the mask with the lowest penalty
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      if (forceMask != null && mask !== forceMask) continue;
      var t = m.map(function (r) { return r.slice(); });
      for (i = 0; i < size; i++) {
        for (j2 = 0; j2 < size; j2++) {
          if (isFunctionModule(version, size, i, j2)) continue;
          if (maskFn(mask, i, j2)) t[i][j2] = !t[i][j2];
        }
      }
      applyFormat(t, mask);
      applyVersion(t, version);
      var sc = penalty(t);
      if (sc < bestScore) { bestScore = sc; best = t; bestMask = mask; }
    }
    var j2;
    return { size: size, modules: best, version: version, mask: bestMask };
  }

  // A module is "function" (unmaskable) if it belongs to a finder, separator,
  // timing line, alignment pattern, format/version area or the dark module.
  function isFunctionModule(version, size, r, c) {
    if (r <= 8 && c <= 8) return true;                          // TL finder + format
    if (r <= 8 && c >= size - 8) return true;                   // TR finder + format
    if (r >= size - 8 && c <= 8) return true;                   // BL finder + format
    if (r === 6 || c === 6) return true;                        // timing
    if (version >= 7) {
      if (r < 6 && c >= size - 11 && c < size - 8) return true; // version info TR
      if (c < 6 && r >= size - 11 && r < size - 8) return true; // version info BL
    }
    var pos = ALIGN[version], last = pos.length - 1;
    for (var i = 0; i <= last; i++) {
      for (var j = 0; j <= last; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        if (Math.abs(r - pos[i]) <= 2 && Math.abs(c - pos[j]) <= 2) return true;
      }
    }
    return false;
  }

  /** svg(text, opts) -> SVG string, one path, quiet zone included. */
  function svg(text, opts) {
    opts = opts || {};
    var q = opts.quiet == null ? 2 : opts.quiet;
    var res = encode(text, opts.minVersion);
    var n = res.size, total = n + q * 2, d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (res.modules[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
      '" shape-rendering="crispEdges" role="img" aria-label="' + (opts.label || 'QR code') + '">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + (opts.bg || '#fff') + '"/>' +
      '<path d="' + d + '" fill="' + (opts.fg || '#000') + '"/></svg>';
  }

  root.QR = { encode: encode, svg: svg };
})(root);
export const QR = root.QR;
export const qrSVG = (text, opts) => root.QR.svg(text, opts);
