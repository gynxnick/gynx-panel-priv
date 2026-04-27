@extends('layouts.gynx-admin')

@section('title', 'Create User')
@section('header-title', 'Create user')
@section('header-sub', 'Add a new user to the system.')

@section('content')
    <form method="post">
        {{ csrf_field() }}
        <div class="grid grid--cols-2">
            <div class="card">
                <div class="card__header">
                    <h3 class="card__title">Identity</h3>
                </div>
                <div class="card__body">
                    <div class="field">
                        <label class="field__label" for="u-email">Email</label>
                        <input id="u-email" type="text" autocomplete="off" name="email"
                               value="{{ old('email') }}" class="field__input">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-username">Username</label>
                        <input id="u-username" type="text" autocomplete="off" name="username"
                               value="{{ old('username') }}" class="field__input">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-first">Client first name</label>
                        <input id="u-first" type="text" autocomplete="off" name="name_first"
                               value="{{ old('name_first') }}" class="field__input">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-last">Client last name</label>
                        <input id="u-last" type="text" autocomplete="off" name="name_last"
                               value="{{ old('name_last') }}" class="field__input">
                    </div>
                    <div class="field">
                        <label class="field__label" for="u-lang">Default language</label>
                        <select id="u-lang" name="language" class="field__select">
                            @foreach($languages as $key => $value)
                                <option value="{{ $key }}" @if(config('app.locale') === $key) selected @endif>{{ $value }}</option>
                            @endforeach
                        </select>
                        <span class="field__hint">The default language to use when rendering the panel for this user.</span>
                    </div>
                </div>
                <div class="card__footer">
                    <button type="submit" class="btn btn--primary">Create user</button>
                </div>
            </div>

            <div>
                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">Permissions</h3>
                    </div>
                    <div class="card__body">
                        <div class="field" style="margin-bottom: 0;">
                            <label class="field__label" for="u-admin">Administrator</label>
                            <select id="u-admin" name="root_admin" class="field__select">
                                <option value="0">@lang('strings.no')</option>
                                <option value="1">@lang('strings.yes')</option>
                            </select>
                            <span class="field__hint">Setting this to <strong>yes</strong> gives a user full administrative access.</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card__header">
                        <h3 class="card__title">Password</h3>
                    </div>
                    <div class="card__body">
                        <div class="alert alert--info">
                            Providing a password is optional. New-user emails prompt users to create a password the
                            first time they log in. If a password is provided here, you'll need to deliver it out-of-band.
                        </div>
                        <div id="gen_pass" class="alert alert--success" style="display:none;"></div>
                        <div class="field" style="margin-bottom: 0;">
                            <label class="field__label" for="u-pass">Password</label>
                            <input id="u-pass" type="password" name="password" class="field__input">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
@endsection

@section('footer-scripts')
    <script>
        document.addEventListener('click', function (e) {
            var btn = document.getElementById('gen_pass_bttn');
            if (!btn || e.target !== btn) return;
            e.preventDefault();
            fetch('/password-gen/12', { headers: { 'X-CSRF-TOKEN': '{{ csrf_token() }}' } })
                .then(function (r) { return r.text(); })
                .then(function (data) {
                    var box = document.getElementById('gen_pass');
                    box.innerHTML = '<strong>Generated password:</strong> ' + data;
                    box.style.display = 'block';
                    var pwd = document.querySelector('input[name="password"]');
                    if (pwd) pwd.value = data;
                });
        });
    </script>
@endsection
