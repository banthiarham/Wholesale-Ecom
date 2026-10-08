-- Bank Transfer can have several bank accounts, one PaymentGateway row each (the "provider" lookup index stays).
DROP INDEX IF EXISTS "PaymentGateway_provider_key";
