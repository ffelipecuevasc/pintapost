/**
 * Tests del formateo de cifras del contador (S05).
 *
 * _Archivo añadido sobre la marcha: no estaba en la lista del sprint._
 *
 * Existe porque `groupThousands` sustituye a `toLocaleString("es-ES")` por un
 * motivo que no se ve leyendo el código: en español, un número de **cuatro
 * cifras** no lleva separador de miles, y todas las cifras de este contador
 * tienen cuatro. El test de 2.800 es el que documenta esa diferencia; sin él,
 * alguien "simplificaría" el archivo devolviendo a `toLocaleString` y el punto
 * desaparecería de la interfaz sin que nada se pusiera rojo.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  characters,
  groupThousands,
} from "../public/static/js/ui/format.js";

describe("groupThousands", () => {
  test("los números de menos de mil salen tal cual", () => {
    assert.equal(groupThousands(0), "0");
    assert.equal(groupThousands(7), "7");
    assert.equal(groupThousands(999), "999");
  });

  test("agrupa a partir de mil", () => {
    assert.equal(groupThousands(1000), "1.000");
    assert.equal(groupThousands(1890), "1.890");
    assert.equal(groupThousands(3000), "3.000");
  });

  test("agrupa las cifras de cuatro dígitos, que es donde falla el locale", () => {
    // `(2800).toLocaleString("es-ES")` devuelve "2800": CLDR asigna al español
    // `minimumGroupingDigits: 2`. Correcto según la norma, y justo el rango
    // entero de este contador.
    assert.equal(groupThousands(2800), "2.800");
    assert.notEqual(groupThousands(2800), (2800).toLocaleString("es-ES"));
  });

  test("agrupa más allá del millón", () => {
    assert.equal(groupThousands(12345), "12.345");
    assert.equal(groupThousands(1234567), "1.234.567");
  });
});

describe("characters", () => {
  test("concuerda el singular", () => {
    assert.equal(characters(1), "1 carácter");
  });

  test("y el plural, incluido el cero", () => {
    assert.equal(characters(0), "0 caracteres");
    assert.equal(characters(2), "2 caracteres");
  });

  test("lleva el separador de miles", () => {
    assert.equal(characters(1240), "1.240 caracteres");
  });
});
