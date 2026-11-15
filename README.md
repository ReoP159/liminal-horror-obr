# Extensión de Liminal Horror para Owlbear Rodeo (OBR 2.0)

Extensión de ficha de personaje y panel de control para el juego de rol **Liminal Horror** en el VTT **Owlbear Rodeo**.

## Características

* **Ficha Personal por Jugador:** Cada participante en la sala de Owlbear Rodeo ve y edita su propia ficha de forma independiente (sincronizada en tiempo real mediante `OBR.room` y `OBR.broadcast`).
* **Panel de Resumen para el Guardián (GM):**
  * Vista de la **Mesa** con el estado de todos los investigadores en vivo (HP, Armadura, Estabilidad, Atributos y Fatiga).
  * Inspección y edición directa de fichas de jugadores.
  * **Tiradas de PNJ en vivo:** Permite al GM tirar atributos bajo el nombre de cualquier criatura o PNJ, transmitiendo la animación a toda la mesa.
* **Tiradas de Salvación d20 interactivas:** Clic en cualquier atributo para lanzar 1d20 con animación minimalista y veredicto instantáneo de Éxito / Fallo visible para todos.
* **Restricciones del Sistema:**
  * Atributos limitados a máximo 19.
  * HP limitado a máximo 10 (con clic en "HP" para restaurar al máximo).
  * Armadura (máximo 4) y Estabilidad (máximo 3).
  * Contador de espacios ocupados en inventario `(x/10)`.

---

## Cómo agregar la extensión a Owlbear Rodeo

1. Entra a tu cuenta en [Owlbear Rodeo](https://www.owlbear.rodeo).
2. Ve a tu Perfil > **Extensions** > **Add Extension**.
3. Pega la URL directa al archivo `manifest.json` de tu extensión:
   ```text
   https://TU_DOMINIO_O_HOST/manifest.json
   ```
4. Abre cualquier sala de Owlbear Rodeo y activa la extensión desde la barra de herramientas.
