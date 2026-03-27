 = @{ producto='T10'; referencia='2411980520'; monto='10'; idOperador='1'; operador='Telcel'; numero='2411980520'; telefono='2411980520'; numeroRecarga='2411980520'; numeroReferencia='2411980520' } | ConvertTo-Json  
Invoke-RestMethod -Uri 'http://localhost:3000/api/taecel/admin/RequestTXN' -Method POST -ContentType 'application/json' -Body  | ConvertTo-Json  
