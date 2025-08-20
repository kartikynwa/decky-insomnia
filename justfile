set dotenv-filename := "deck.env"
set dotenv-required

plugin_name := `basename $(pwd)`

deck_hostname := env('DECK_HOSTNAME')
deck_password := env('DECK_PASSWORD')

depsetup:
    .vscode/setup.sh

pnpmsetup:
    pnpm i

updatefrontendlib:
    pnpm update @decky/ui --latest

setup: depsetup pnpmsetup updatefrontendlib
    echo 'Setup completed'

buildfrontend:
    pnpm build

build: buildfrontend
    -rm -rf build
    mkdir -p build
    cp -r mpv_script dist LICENSE *.py package.json plugin.json README.md build

buildzip: build
    cd build && zip -r ../{{plugin_name}}.zip *

deploy: build
    rsync -azpv --delete --chmod=D0755,F0755 build/ "$DECK_HOSTNAME":"homebrew/plugins/{{plugin_name}}"
    echo "$DECK_PASSWORD" | ssh "$DECK_HOSTNAME" sudo -S systemctl restart plugin_loader.service
