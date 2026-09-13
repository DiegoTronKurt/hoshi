import { parseGameResult, parseSgf, sgfToGameRecord } from '../core/sgf'
import type { RecordedMove } from '../core/sgf'

/**
 * Las 5 partidas del duelo AlphaGo vs. Lee Sedol (Seul, marzo de 2016),
 * SGF exacto (sin ningun cambio) de
 * homepages.cwi.nl/~aeb/go/games/games/AlphaGo/LeeSedol/{1..5}.sgf --
 * coleccion explicitamente de dominio publico ("I do not claim any rights
 * on this collection. The games here are in the public domain."), la
 * misma que ya respalda el archivo de 90000+ partidas profesionales citado
 * en el plan de ruta. Se usa la version SIN comentarios (`N.sgf`, no
 * `Nc.sgf`): esa segunda version trae anotaciones de Fan Hui insertadas en
 * el archivo, texto de otra persona que esta app no tiene licencia para
 * redistribuir -- el analisis que se muestra en la app es siempre propio
 * (ver FullGameReviewPanel), nunca ese comentario ajeno. Ver NOTAS.md para
 * el detalle completo de la verificacion de licencia.
 */

const GAME_1_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[1]
PB[Lee Sedol]
BR[9p]
PW[AlphaGo]
TM[2h]
KM[7.5]
RE[W+R]
DT[2016-03-09]
PC[Four Seasons Hotel, Seoul, Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[qd];W[dd];B[pq];W[dp];B[fc];W[cf];B[ql];W[od];B[ld];W[qc]
;B[rc];W[pc];B[re];W[of];B[pg];W[og];B[ph];W[id];B[lf];W[oh]
;B[pi];W[lh];B[kh];W[ke];B[le];W[lg];B[kg];W[kf];B[ne];W[oe]
;B[jc];W[ic];B[jd];W[ie];B[je];W[jf];B[if];W[jg];B[li];W[mi]
;B[hf];W[ih];B[mb];W[gd];B[ki];W[mj];B[kk];W[ib];B[ob];W[ml]
;B[lm];W[nc];B[nb];W[kb];B[lc];W[mm];B[ln];W[kl];B[ll];W[lk]
;B[jj];W[jl];B[hj];W[hi];B[gj];W[gf];B[ii];W[jh];B[ij];W[mn]
;B[lo];W[mo];B[lp];W[mp];B[lq];W[mq];B[im];W[qo];B[fq];W[gg]
;B[cn];W[dn];B[dm];W[fp];B[gp];W[gq];B[fr];W[co];B[en];W[do]
;B[ep];W[cm];B[dl];W[lr];B[kr];W[rb];B[jb];W[ja];B[mf];W[mh]
;B[nd];W[qj];B[pj];W[qk];B[pl];W[pk];B[ok];W[rh];B[rl];W[qf]
;B[ri];W[rf];B[pf];W[qe];B[qh];W[cc];B[bn];W[bm];B[bl];W[bo]
;B[rg];W[mr];B[po];W[jr];B[kq];W[pn];B[oo];W[qp];B[on];W[pp]
;B[op];W[qq];B[or];W[pr];B[oq];W[pd];B[qr];W[rr];B[ps];W[rs]
;B[rn];W[ro];B[qn];W[so];B[cl];W[an];B[ks];W[om];B[ol];W[ci]
;B[hh];W[hg];B[dr];W[dj];B[bq];W[cq];B[cr];W[bp];B[dq];W[br]
;B[cp];W[ap];B[ek];W[fi];B[bj];W[bi];B[pb];W[qb];B[sf];W[rd]
;B[ai];W[ah];B[aj];W[bh];B[gi];W[fj];B[fk];W[oc];B[mc];W[cj]
;B[al];W[nm];B[pm];W[aq];B[gh];W[fh]
C[Time used: B: 1h32m, W: 1h55m]
)`

const GAME_2_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[2]
PB[AlphaGo]
PW[Lee Sedol]
WR[9p]
TM[2h]
KM[7.5]
RE[B+R]
DT[2016-03-10]
PC[Four Seasons Hotel, Seoul, Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[pd];W[dp];B[cd];W[qp];B[op];W[oq];B[nq];W[pq];B[cn];W[fq]
;B[mp];W[qn];B[ic];W[dj];B[po];W[qo];B[cp];W[cq];B[bq];W[co]
;B[bp];W[bo];B[do];W[bn];B[dq];W[ep];B[dr];W[cm];B[jp];W[cg]
;B[ed];W[qf];B[qe];W[pf];B[nd];W[pi];B[oj];W[oi];B[nj];W[mh]
;B[gp];W[gq];B[dn];W[dm];B[fo];W[hp];B[ho];W[eo];B[en];W[fn]
;B[em];W[el];B[fm];W[gn];B[fl];W[go];B[ek];W[dk];B[dl];W[cl]
;B[eh];W[di];B[pj];W[qi];B[rf];W[rg];B[kd];W[hn];B[om];W[re]
;B[rd];W[sf];B[fi];W[gk];B[hm];W[in];B[hl];W[ko];B[kp];W[gc]
;B[df];W[id];B[jc];W[ge];B[dg];W[cf];B[ch];W[bh];B[dh];W[bi]
;B[hd];W[he];B[gd];W[fd];B[hc];W[fe];B[ec];W[gh];B[fc];W[gi]
;B[ii];W[hk];B[ik];W[il];B[im];W[ij];B[jl];W[jj];B[if];W[km]
;B[kl];W[lj];B[lk];W[lo];B[li];W[kj];B[ci];W[cj];B[mj];W[nr]
;B[mr];W[lq];B[lp];W[mq];B[np];W[lr];B[lm];W[kh];B[hg];W[qc]
;B[qd];W[rc];B[pc];W[sd];B[gg];W[ce];B[bd];W[qb];B[hi];W[jg]
;B[hj];W[ob];B[pb];W[pa];B[nb];W[de];B[ee];W[gj];B[hh];W[ej]
;B[nf];W[mf];B[me];W[rk];B[fh];W[el];B[nh];W[ng];B[lg];W[lh]
;B[mg];W[og];B[kg];W[ni];B[jh];W[na];B[ki];W[mi];B[ji];W[nc]
;B[mb];W[od];B[mc];W[oc];B[kr];W[ms];B[io];W[ip];B[jo];W[jn]
;B[ir];W[hr];B[ql];W[rl];B[qm];W[rm];B[ao];W[bm];B[ln];W[kn]
;B[mo];W[be];B[ae];W[af];B[ad];W[ma];B[la];W[oa];B[dd];W[bg]
;B[lb];W[pn];B[on];W[er];B[cr];W[fp];B[iq];W[hq];B[qj];W[rj]
;B[ks]
C[Time used: B: 2h, W: 2h+2x60s]
)`

const GAME_3_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[3]
PB[Lee Sedol]
BR[9p]
PW[AlphaGo]
TM[2h]
KM[7.5]
RE[W+R]
DT[2016-03-12]
PC[Four Seasons Hotel, Seoul, Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[pd];W[pp];B[cd];W[dp];B[cn];W[fq];B[id];W[qf];B[nc];W[qm]
;B[dj];W[ed];B[dc];W[eg];B[ef];W[de];B[df];W[ce];B[ec];W[fd]
;B[ff];W[fc];B[bd];W[he];B[ie];W[hd];B[ic];W[hg];B[if];W[gg]
;B[jh];W[ci];B[dg];W[di];B[ei];W[bg];B[bh];W[be];B[bi];W[cj]
;B[dh];W[dk];B[ej];W[ck];B[ch];W[gi];B[fh];W[dm];B[dn];W[fg]
;B[eh];W[fm];B[ek];W[el];B[gk];W[ii];B[cm];W[fo];B[en];W[fl]
;B[bk];W[bj];B[aj];W[hm];B[hj];W[hi];B[gj];W[ji];B[il];W[jn]
;B[cp];W[cq];B[dq];W[dr];B[bq];W[eq];B[pm];W[pl];B[qn];W[om]
;B[pn];W[ql];B[ol];W[on];B[rn];W[oo];B[ok];W[qi];B[ll];W[hc]
;B[qq];W[qp];B[rp];W[pq];B[rq];W[qr];B[rr];W[ln];B[qe];W[re]
;B[rd];W[pe];B[qd];W[bb];B[dd];W[ee];B[cb];W[bc];B[ad];W[eb]
;B[ba];W[gb];B[qk];W[pk];B[lo];W[mn];B[pj];W[qj];B[rl];W[rk]
;B[rm];W[qk];B[cr];W[pf];B[iq];W[kq];B[lq];W[jq];B[jo];W[kn]
;B[hr];W[ip];B[hp];W[io];B[jr];W[kr];B[ho];W[gq];B[hq];W[in]
;B[fn];W[gn];B[go];W[gr];B[gs];W[fs];B[is];W[ib];B[ks];W[lr]
;B[dq];W[hn];B[ds];W[cq];B[fp];W[eo];B[do];W[ep];B[er];W[hs]
;B[qh];W[ph];B[gs];W[dq];B[br];W[hs];B[pi];W[oh];B[gs];W[bp]
;B[hs];W[co];B[bo];W[bn];B[cp];W[cs]
C[Time used: B: 2h+2x60s, W: 1h51m]
)`

const GAME_4_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[4]
PB[AlphaGo]
PW[Lee Sedol]
WR[9p]
TM[2h]
KM[7.5]
RE[W+R]
DT[2016-03-13]
PC[Four Seasons Hotel, Seoul, South Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[pd];W[dp];B[cd];W[qp];B[op];W[oq];B[nq];W[pq];B[cn];W[fq]
;B[mp];W[po];B[iq];W[ec];B[hd];W[cg];B[ed];W[cj];B[dc];W[bp]
;B[nc];W[qi];B[ep];W[eo];B[dk];W[fp];B[ck];W[dj];B[ej];W[ei]
;B[fi];W[eh];B[fh];W[bj];B[fk];W[fg];B[gg];W[ff];B[gf];W[mc]
;B[md];W[lc];B[nb];W[id];B[hc];W[jg];B[pj];W[pi];B[oj];W[oi]
;B[ni];W[nh];B[mh];W[ng];B[mg];W[mi];B[nj];W[mf];B[li];W[ne]
;B[nd];W[mj];B[lf];W[mk];B[me];W[nf];B[lh];W[qj];B[kk];W[ik]
;B[ji];W[gh];B[hj];W[ge];B[he];W[fd];B[fc];W[ki];B[jj];W[lj]
;B[kh];W[jh];B[ml];W[nk];B[ol];W[ok];B[pk];W[pl];B[qk];W[nl]
;B[kj];W[ii];B[rk];W[om];B[pg];W[ql];B[cp];W[co];B[oe];W[rl]
;B[sk];W[rj];B[hg];W[ij];B[km];W[gi];B[fj];W[jl];B[kl];W[gl]
;B[fl];W[gm];B[ch];W[ee];B[eb];W[bg];B[dg];W[eg];B[en];W[fo]
;B[df];W[dh];B[im];W[hk];B[bn];W[if];B[gd];W[fe];B[hf];W[ih]
;B[bh];W[ci];B[ho];W[go];B[or];W[rg];B[dn];W[cq];B[pr];W[qr]
;B[rf];W[qg];B[qf];W[jc];B[gr];W[sf];B[se];W[sg];B[rd];W[bl]
;B[bk];W[ak];B[cl];W[hn];B[in];W[hp];B[fr];W[er];B[es];W[ds]
;B[ah];W[ai];B[kd];W[ie];B[kc];W[kb];B[gk];W[ib];B[qh];W[rh]
;B[qs];W[rs];B[oh];W[sl];B[of];W[sj];B[ni];W[nj];B[oo];W[jp]
C[Time used: B: 1h59m, W: 2h+2x60s]
)`

const GAME_5_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[5]
PB[Lee Sedol]
BR[9p]
PW[AlphaGo]
TM[2h]
KM[7.5]
RE[W+R]
DT[2016-03-15]
PC[Four Seasons Hotel, Seoul, South Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[qd];W[dd];B[pq];W[dp];B[oc];W[po];B[qo];W[qn];B[qp];W[pm]
;B[nq];W[qe];B[pe];W[qf];B[rd];W[pf];B[ql];W[oe];B[pl];W[ol]
;B[om];W[ok];B[nm];W[qj];B[rn];W[gq];B[cf];W[fc];B[bd];W[ch]
;B[dh];W[di];B[dg];W[cc];B[ci];W[cj];B[bi];W[dj];B[bh];W[ml]
;B[mm];W[lm];B[nl];W[nk];B[ln];W[ll];B[kn];W[mn];B[mo];W[rm]
;B[rl];W[ro];B[sn];W[pn];B[oo];W[op];B[no];W[sm];B[pp];W[nc]
;B[nb];W[ob];B[pb];W[od];B[pc];W[mb];B[oa];W[mc];B[gd];W[gf]
;B[gc];W[fd];B[ge];W[ff];B[hf];W[hg];B[if];W[ig];B[id];W[jf]
;B[jb];W[jd];B[jc];W[je];B[gh];W[fb];B[gg];W[fe];B[hc];W[hi]
;B[jl];W[hb];B[gb];W[ga];B[ib];W[ha];B[ia];W[fa];B[ka];W[iq]
;B[ii];W[hh];B[hj];W[gi];B[gj];W[cn];B[dq];W[cq];B[fq];W[eq]
;B[fp];W[gp];B[do];W[co];B[ep];W[dr];B[er];W[dq];B[gr];W[fo]
;B[eo];W[fn];B[hr];W[in];B[ir];W[jq];B[kr];W[jr];B[js];W[kq]
;B[lr];W[lq];B[mq];W[mr];B[nr];W[ik];B[fi];W[fh];B[jk];W[ij]
;B[jj];W[il];B[jm];W[im];B[eh];W[fg];B[mj];W[lj];B[li];W[mi]
;B[lk];W[nj];B[kj];W[ei];B[bk];W[bj];B[aj];W[is];B[hs];W[so]
;B[rn];W[rk];B[sl];W[ai];B[ah];W[cl];B[bl];W[bm];B[dm];W[dn]
;B[cm];W[dl];B[em];W[en];B[fl];W[fj];B[bn];W[ak];B[al];W[fr]
;B[mh];W[ni];B[lg];W[ks];B[ls];W[bc];B[bo];W[bp];B[og];W[mf]
;B[nh];W[ph];B[ce];W[mk];B[sg];W[rg];B[gl];W[re];B[se];W[sf]
;B[rf];W[sh];B[ld];W[me];B[ac];W[ab];B[ad];W[cd];B[bf];W[kc]
;B[kb];W[oh];B[nf];W[lc];B[bb];W[cb];B[aa];W[gk];B[hl];W[hk]
;B[jh];W[kg];B[lf];W[kh];B[lh];W[le];B[kf];W[jg];B[ao];W[lj]
;B[ki];W[jn];B[km];W[sn];B[on];W[rp];B[rq];W[pk];B[qm];W[sf]
;B[sd];W[ma];B[na];W[ie];B[he];W[hq];B[ms];W[ko];B[lp];W[kp]
;B[lo];W[fs];B[ks];W[el];B[fm];W[hm];B[am];W[kk];B[ne];W[of]
;B[de];W[ap];B[ee];W[ed];B[ke];W[kd];B[pd];W[pg];B[ng];W[sk]
;B[rn];W[fk];B[kl];W[gm];B[bm];W[lk];B[ck];W[dk];B[qk];W[rj]
C[Time used: B: 2h+2x60s, W: 2h]
)`

export interface HistoricGameResult {
  winner: 'black' | 'white'
  /** RE del SGF: 'resign' cubre las 5 partidas de este duelo (todas
   * terminaron por rendicion, RE[W+R]/RE[B+R]) -- parseGameResult en
   * core/sgf.ts solo reconoce el caso con margen numerico ('points'), asi
   * que el ganador de una partida por rendicion se lee a mano de RE en vez
   * de perderse como "sin resultado" (que es el comportamiento correcto
   * para el importador de partidas propias en content/sgfImport.ts, pero
   * no serviria aca: estas partidas son contenido fijo, no algo que un
   * usuario pueda simplemente no importar). */
  method: 'resign' | 'points'
  margin?: number
}

export interface HistoricGame {
  id: string
  round: number
  blackName: string
  whiteName: string
  /** ISO (YYYY-MM-DD), tal cual DT del SGF original. */
  date: string
  width: number
  height: number
  komi: number
  moves: RecordedMove[]
  result: HistoricGameResult
}

function buildHistoricGame(id: string, sgfText: string): HistoricGame {
  const { root } = parseSgf(sgfText)
  const { width, height, komi, moves } = sgfToGameRecord(sgfText)
  const re = root.properties.RE?.[0] ?? ''
  const numeric = parseGameResult(re)
  const winner: 'black' | 'white' = numeric ? numeric.winner : re.startsWith('B') ? 'black' : 'white'

  return {
    id,
    round: Number(root.properties.RO?.[0] ?? '0'),
    blackName: root.properties.PB?.[0] ?? '?',
    whiteName: root.properties.PW?.[0] ?? '?',
    date: root.properties.DT?.[0] ?? '',
    width,
    height,
    komi,
    moves,
    result: {
      winner,
      method: numeric ? 'points' : 'resign',
      margin: numeric ? (winner === 'black' ? numeric.black : numeric.white) : undefined,
    },
  }
}

/** Duelo AlphaGo vs. Lee Sedol, Seul, marzo de 2016 -- 4-1 para AlphaGo,
 * con la unica victoria de Lee Sedol en la partida 4. Orden cronologico
 * real (mismo orden que RO en cada SGF). */
export const ALPHAGO_LEE_SEDOL_GAMES: HistoricGame[] = [
  buildHistoricGame('alphago-leesedol-1', GAME_1_SGF),
  buildHistoricGame('alphago-leesedol-2', GAME_2_SGF),
  buildHistoricGame('alphago-leesedol-3', GAME_3_SGF),
  buildHistoricGame('alphago-leesedol-4', GAME_4_SGF),
  buildHistoricGame('alphago-leesedol-5', GAME_5_SGF),
]
