SHELL := /bin/bash

DOCKER_COMPOSE_LOCAL = docker-compose -p local-caretaker -f docker-compose.local.yml --compatibility

build:
	@$(DOCKER_COMPOSE_LOCAL) build

run: generate-types
	clear
	./.start-dev.sh	

stop:
	$(DOCKER_COMPOSE_LOCAL) stop

generate-types:
	npx pocketbase-typegen --db ./server/pb_data/data.db --out client/src/pocketbase_types.ts
