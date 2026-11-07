// Captures de pantalla per revisar el disseny (no són proves: no s'executen
// amb les altres). Les desa a docs/captures/<carpeta>/ amb dades inventades.
//
//   CAPTURES=3a npx playwright test -c playwright.captures.config.ts
//
// CAPTURES_SUFIX (p. ex. «abans») s'afegeix al nom dels fitxers.
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'

const CARPETA = `docs/captures/${process.env.CAPTURES ?? 'proves'}`
const SUFIX = process.env.CAPTURES_SUFIX ? `-${process.env.CAPTURES_SUFIX}` : ''
const P = 'contrasenya-inventada-captures'
// Dates relatives a avui (el Google simulat fa servir l'hora real: amb un
// rellotge fix sortiria l'avís de rellotge desfasat)
const dia = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
test.describe.configure({ timeout: 180_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function capturar(page: Page, nom: string) {
  mkdirSync(CARPETA, { recursive: true })
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${CARPETA}/${nom}${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.png`, fullPage: true })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function pacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function cita(page: Page, qui: string, dia: string, hora: string, motiu: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova cita' })
  await d.getByLabel('Data').fill(dia)
  await d.getByLabel('Hora').fill(hora)
  await d.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(qui)
  await d.getByRole('button', { name: new RegExp(qui) }).first().click()
  await d.getByLabel('Motiu').fill(motiu)
  await d.getByRole('button', { name: /^(Desar|Registrar)/ }).click()
  await expect(d).toBeHidden()
}

test('Avui', async ({ page }) => {
  await entrar(page)
  await pacient(page, 'Aina', 'Provencal Inventada')
  await pacient(page, 'Bernat', 'Prova Inventat')
  await pacient(page, 'Carla', 'Exemple Inventada')
  // Cites anteriors (Bernat i Carla ja en tenen: avui són seguiments)
  await cita(page, 'Bernat', dia(-7), '11:00', 'Lumbàlgia')
  await cita(page, 'Carla', dia(-14), '12:00', 'Acúfens')
  await cita(page, 'Aina', dia(0), '21:00', 'Insomni i ansietat')
  await cita(page, 'Bernat', dia(0), '22:15', 'Lumbàlgia')
  await cita(page, 'Carla', dia(0), '23:00', 'Acúfens')
  await menu(page, 'Avui').click()
  await expect(page.getByRole('heading', { name: 'Cites d\'avui' })).toBeVisible()
  await capturar(page, 'avui')
})
