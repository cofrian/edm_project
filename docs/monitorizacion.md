# Monitorización — UrbanFlow Valencia

## Qué se monitoriza
- **Modelo activo** y **fecha de los datos** (`/metadata`, `/monitoring/alerts`).
- **MAE por hora**: detecta franjas con menor fiabilidad.
- **Top zonas con más error**: a partir de `validation_predictions.csv`.
- **MAE global** vs umbral configurable (`MAE_ALERT_THRESHOLD`).

## Umbrales y alertas
- Si el MAE de una hora supera el umbral (por defecto 80 veh/h) se genera una alerta.
- Nivel `alta` si MAE > 1.5× media; `media` si supera el umbral; `ok` si todo dentro de rango.

Ejemplo de alerta:

> La hora 08 presenta un error (MAE=109.7) por encima del umbral. Las predicciones en esta
> franja deben interpretarse con menor confianza.

## Drift
- Los datos son de octubre 2023. Cambios estacionales, de sensores o de movilidad pueden
  degradar el modelo. En producción se compararía el error vivo contra este baseline y se
  reentrenaría periódicamente.

## Limitaciones
- Mayor error en horas valle (madrugada) y algunas zonas periféricas.
- La monitorización actual es sobre el holdout; en producción se añadiría telemetría de
  predicciones reales y detección de drift de distribución.

## Producción real (siguiente paso)
- Registrar predicciones y comparar contra ground-truth cuando llegue.
- Alertas automáticas (email/Slack) si el MAE semanal supera el umbral.
- Versionado de modelos y promoción `develop → main → production`.
