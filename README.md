# 🎮 AETHERIA — Guardianes del Cristal

**Action-RPG anime 3D para Android** con cel-shading estilo Dragon Quest / Genshin, construido sobre Three.js dentro de un WebView nativo 100% offline.

> Reescritura total del antiguo *Base Defense 3D*. Todo el arte 3D es nuevo: personajes chibi articulados con caras anime, armas con brillo elemental, jefes con coronas, cielos procedurales, agua animada y ciclo día/noche.

## 📲 Instalar en tu celular

1. Ve a la pestaña **[Releases](../../releases)** de este repositorio.
2. Descarga el `Aetheria-vX.Y.Z.apk` de la última versión.
3. Ábrelo en el teléfono y acepta *"instalar de orígenes desconocidos"*.
4. ¡Listo! Requiere **Android 7.0+**. No necesita internet.

## 🗡️ Modos de juego

| Modo | Descripción |
|---|---|
| 📖 **Campaña** | 25 niveles en 5 regiones (Valle, Desierto, Picos Helados, Volcán, Vacío) con 6 jefes únicos, mapa de progresión y 75 estrellas posibles. |
| 🏰 **Defensa Infinita** | El clásico base defense llevado al extremo: oleadas eternas, jefe cada 10, tienda entre oleadas, mejoras acumulables. |
| 👑 **Arena Suprema** | Battle royale: planea al caer, saquea cofres, la zona se encoge, 19 bots luchan entre sí… el último en pie gana. |
| 🗺️ **Mundo Abierto** | Valle gigante con aldea, 4 NPCs con diálogo, misiones, campamentos que reaparecen, 12 fragmentos de cristal y cofres. |

## ✨ Sistemas de progresión

- **8 héroes coleccionables** (R → UR) con gacha/pity: Kael, Lyra, Mira, Ronan, Zed, Sylvie, Ignis y Nyx — cada uno con 2 habilidades + definitiva única.
- **20 armas** en 7 clases (espada, mandoble, lanza, arco, bastón, dagas, martillo) con rareza, elemento y mejoras +N.
- **15 armaduras** en 3 slots (casco/pechera/botas) con sets de cuero → acero → mithril → dragón → éter.
- **Economía**: 🪙 oro (batallas) · 💎 gemas (premium, tienda lista para monetizar) · 🎟️ tickets de invocación.
- **Misiones diarias/semanales**, 15 logros, recompensas de login de 7 días y eventos rotativos por día de la semana.
- **Combate con jugo**: combos de 3 golpes, dodge con i-frames, reacciones elementales (quemadura, congelación, aturdimiento, veneno, raíces), hit-stop, screen shake, números de daño, auto-aim, auto-ataque configurable.
- **3 cámaras** conmutables en partida: 3ª persona, aérea táctica y 1ª persona.
- **Audio 100% sintetizado** (WebAudio): música por situación (menú/batalla/jefe/royale/noche) y decenas de efectos — sin archivos de sonido.

## 🛠️ Compilar

```bash
# Con Android Studio: abre el proyecto y Run
# O con Gradle 9.8+ y JDK 21:
gradle assembleRelease
# APK en app/build/outputs/apk/release/
```

La APK de release se firma con la clave de debug si no se configuran `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` (para publicación en Play Store usa tu propio keystore).

## 🔁 CI/CD

`.github/workflows/android-release.yml` compila la APK y publica un **Release** automáticamente con cada tag `v*`:

```bash
git tag v2.0.1 && git push origin v2.0.1   # → APK nuevo en Releases
```

## 🏗️ Arquitectura

```
app/src/main/assets/
  game.html          # Shell + HUD + CSS (todo el UI)
  lib/three.min.js   # Three.js r128 empaquetado (offline)
  fonts/             # Cinzel + Rubik (woff2 local)
  js/
    utils.js         # Helpers, audio sintetizado, guardado (localStorage)
    data.js          # Héroes/armas/armaduras/enemigos/jefes/campaña/misiones
    models.js        # Personajes anime procedurales, enemigos, props, armas
    vfx.js           # Partículas, cielo, agua, números de daño, telegrafías
    engine.js        # Renderer, mundos temáticos, día/noche, rig de cámara
    combat.js        # Jugador, IA, jefes con fases, proyectiles, loot
    ui.js            # Menús, HUD, gacha, tienda, mapa, misiones
    modes.js         # Campaña, Defensa, Royale, Mundo Abierto
    main.js          # Bucle, economía, XP, misiones, input táctil
```

El juego también corre en cualquier navegador de escritorio abriendo `game.html` desde un servidor local (usa mouse para joystick/cámara).
