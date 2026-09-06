PROJETO MONITORAMENTO GPS 2.0

Recursos:
- Velocidade em tempo real
- Mapa em tempo real
- Trajeto percorrido
- Histórico persistente em JSON
- Velocidade máxima
- Gráfico de velocidade
- Alerta visual acima de 30 km/h
- Link direto para Google Maps
- Painel responsivo para celular
- Blynk continua responsável pelos alertas

INSTALAÇÃO:
1. Instale Node.js.
2. Abra o terminal dentro de "servidor".
3. Execute: npm install
4. Execute: npm start
5. No Windows, use "ipconfig" para descobrir o IPv4 do computador.
6. No .ino, altere serverURL para esse IPv4:
   http://IP_DO_PC:3000/api/gps
7. Preencha seu BLYNK_AUTH_TOKEN, Wi-Fi e senha.
8. Grave o ESP32.
9. Abra http://localhost:3000 no computador.
10. No celular na mesma rede, abra:
    http://IP_DO_PC:3000

O histórico fica em:
servidor/data/gps-history.json

IMPORTANTE:
Esta versão ainda funciona na rede local.
Na versão seguinte, colocaremos o servidor na nuvem para acesso externo.
Não publique seu token Blynk nem sua senha Wi-Fi.


========================================
MONITORAMENTO GPS 3.1
========================================

Além dos recursos anteriores, o painel agora calcula:

- Distância percorrida em km usando latitude/longitude (fórmula de Haversine)
- Velocidade média da viagem
- Tempo de viagem
- Rota no mapa usando o histórico salvo no Supabase
- Correção para não duplicar o último ponto da rota ao carregar o histórico

O ESP32 e o server.js continuam com a mesma estrutura da versão anterior.
