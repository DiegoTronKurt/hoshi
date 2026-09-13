import { describe, expect, it } from 'vitest'
import { ALPHAGO_LEE_SEDOL_GAMES } from '../../src/content/historicGames'
import { applyMove, createGame } from '../../src/core/rules'

/**
 * Mismo principio que content/sgfImport.ts (nunca aceptar una partida
 * externa sin reproducirla entera contra el motor de reglas real) aplicado
 * a contenido fijo en vez de un import de usuario: si alguna de estas 5
 * partidas tuviera una jugada mal transcripta o una regla no soportada
 * (superko, etc.), esto la corta ahi y lo deja en evidencia, en vez de
 * quedar sin detectar hasta que alguien la abra en la app.
 *
 * Numero de jugadas y ganador de cada partida cruzados a mano contra la
 * tabla publicada en homepages.cwi.nl/~aeb/go/games/games/AlphaGo/ (y
 * contra el resultado historico conocido del duelo: 4-1 para AlphaGo, con
 * la unica victoria de Lee Sedol en la partida 4) -- no solo confiar en que
 * el parser haga lo correcto, corroborar contra el hecho conocido.
 */
const EXPECTED = [
  { moveCount: 186, winner: 'white', blackName: 'Lee Sedol', whiteName: 'AlphaGo' },
  { moveCount: 211, winner: 'black', blackName: 'AlphaGo', whiteName: 'Lee Sedol' },
  { moveCount: 176, winner: 'white', blackName: 'Lee Sedol', whiteName: 'AlphaGo' },
  { moveCount: 180, winner: 'white', blackName: 'AlphaGo', whiteName: 'Lee Sedol' },
  { moveCount: 280, winner: 'white', blackName: 'Lee Sedol', whiteName: 'AlphaGo' },
] as const

describe('ALPHAGO_LEE_SEDOL_GAMES', () => {
  it('son exactamente 5 partidas, en orden cronologico', () => {
    expect(ALPHAGO_LEE_SEDOL_GAMES).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(ALPHAGO_LEE_SEDOL_GAMES[i].round).toBe(i + 1)
    }
  })

  ALPHAGO_LEE_SEDOL_GAMES.forEach((game, i) => {
    const expected = EXPECTED[i]

    it(`partida ${i + 1}: metadatos coinciden con el registro historico conocido`, () => {
      expect(game.width).toBe(19)
      expect(game.height).toBe(19)
      expect(game.komi).toBe(7.5)
      expect(game.moves).toHaveLength(expected.moveCount)
      expect(game.blackName).toBe(expected.blackName)
      expect(game.whiteName).toBe(expected.whiteName)
      expect(game.result.winner).toBe(expected.winner)
      expect(game.result.method).toBe('resign')
    })

    it(`partida ${i + 1}: las ${expected.moveCount} jugadas son legales en orden contra el motor de reglas real`, () => {
      let state = createGame(game.width, game.height, game.komi)
      for (const move of game.moves) {
        expect(move.color).toBe(state.toMove)
        const result = applyMove(state, move.point)
        expect(result.legal).toBe(true)
        state = result.state as typeof state
      }
    })
  })
})
