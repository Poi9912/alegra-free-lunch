# Covertura de tests

## Test unitarios

### Api

![Test unitarios - API](img/api-coverage.png)

### Brokers y asíncronos

![Test unitarios - Brokers Async](img/brokers-coverage.png)

### Front

![Test unitarios - Frontend (jestdom)](img/front-coverage.png)

## Analisis estático de código (SonarQube) y vulnerabilidades

![Analisis de código - SonarQube](img/sonar.png)

## Despliegue en ambiente de testing privado

![Despliegue - Dockhand](img/test-env.png)
![Despliegue - Diagrama de dependencias](img/test-dependency-graph.png)
![Visualización en funcionamiento](img/test-view.png)

## Flujo de test automáticos

Todo el proceso integrado de testing se realiza cuando se generan pull request o push a la rama main del repositorio de git forgejo privado, los resultados se suben a la instancia SonarQube privada de mi homelab y posteriormente por integraciones de push se envía al repositorio externo de github, así como señal de actualización a la infraestructura conectada a este repo para despliegues automáticos.