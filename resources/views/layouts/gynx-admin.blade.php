{{--
    Layouts: gynx-admin
    -------------------
    Standalone admin shell — no AdminLTE, no Bootstrap, no jQuery. Used by
    the rebuilt admin pages that match the React-side gynx visual language.

    Pages extending this should provide:
      - @section('title')         page title for <title> tag
      - @section('header-title')  big page title in the top strip
      - @section('header-sub')    optional one-liner under the title
      - @section('content')       main body
--}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'gynx') }} — @yield('title')</title>
    <meta name="_token" content="{{ csrf_token() }}">

    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
    <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
    <link rel="shortcut icon" href="/favicons/favicon.ico">
    <meta name="theme-color" content="#0B0B0F">

    @include('layouts.scripts')

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

    {{-- legacy component CSS (bootstrap grid+modal, select2, sweetalert) — gynx overrides come after --}}
    {!! Theme::css('vendor/bootstrap/bootstrap.min.css?t={cache-version}') !!}
    {!! Theme::css('vendor/select2/select2.min.css?t={cache-version}') !!}
    {!! Theme::css('vendor/sweetalert/sweetalert.min.css?t={cache-version}') !!}

    {!! Theme::css('css/gynx-admin-shell.css?t={cache-version}') !!}
</head>
<body>
    <div class="shell">
        <aside class="sidebar">
            <a href="{{ route('admin.index') }}" class="sidebar__brand">
                <span class="sidebar__brand-mark">G</span>
                <span class="sidebar__brand-name">{{ config('app.name', 'gynx') }}</span>
            </a>

            <nav class="sidebar__nav">
                <div class="sidebar__group-label">Basic</div>
                @php $route = Route::currentRouteName(); @endphp
                <a href="{{ route('admin.index') }}" class="sidebar__link {{ $route === 'admin.index' ? 'is-active' : '' }}">
                    <i class="fa fa-home"></i><span>Overview</span>
                </a>
                <a href="{{ route('admin.settings') }}" class="sidebar__link {{ starts_with($route, 'admin.settings') ? 'is-active' : '' }}">
                    <i class="fa fa-wrench"></i><span>Settings</span>
                </a>
                <a href="{{ route('admin.api.index') }}" class="sidebar__link {{ starts_with($route, 'admin.api') ? 'is-active' : '' }}">
                    <i class="fa fa-gamepad"></i><span>Application API</span>
                </a>

                <div class="sidebar__group-label">Management</div>
                <a href="{{ route('admin.databases') }}" class="sidebar__link {{ starts_with($route, 'admin.databases') ? 'is-active' : '' }}">
                    <i class="fa fa-database"></i><span>Databases</span>
                </a>
                <a href="{{ route('admin.locations') }}" class="sidebar__link {{ starts_with($route, 'admin.locations') ? 'is-active' : '' }}">
                    <i class="fa fa-globe"></i><span>Locations</span>
                </a>
                <a href="{{ route('admin.nodes') }}" class="sidebar__link {{ starts_with($route, 'admin.nodes') ? 'is-active' : '' }}">
                    <i class="fa fa-sitemap"></i><span>Nodes</span>
                </a>
                <a href="{{ route('admin.servers') }}" class="sidebar__link {{ starts_with($route, 'admin.servers') ? 'is-active' : '' }}">
                    <i class="fa fa-server"></i><span>Servers</span>
                </a>
                <a href="{{ route('admin.users') }}" class="sidebar__link {{ starts_with($route, 'admin.users') ? 'is-active' : '' }}">
                    <i class="fa fa-users"></i><span>Users</span>
                </a>

                <div class="sidebar__group-label">Service</div>
                <a href="{{ route('admin.mounts') }}" class="sidebar__link {{ starts_with($route, 'admin.mounts') ? 'is-active' : '' }}">
                    <i class="fa fa-magic"></i><span>Mounts</span>
                </a>
                <a href="{{ route('admin.nests') }}" class="sidebar__link {{ starts_with($route, 'admin.nests') ? 'is-active' : '' }}">
                    <i class="fa fa-th-large"></i><span>Nests</span>
                </a>
                <a href="{{ route('admin.egg-switch.index') }}" class="sidebar__link {{ starts_with($route, 'admin.egg-switch') ? 'is-active' : '' }}">
                    <i class="fa fa-random"></i><span>Egg Switch</span>
                </a>
                <a href="{{ route('admin.addons.plugins') }}" class="sidebar__link {{ starts_with($route, 'admin.addons') ? 'is-active' : '' }}">
                    <i class="fa fa-puzzle-piece"></i><span>Add-ons</span>
                </a>
                <a href="{{ route('admin.alerts.index') }}" class="sidebar__link {{ starts_with($route, 'admin.alerts') ? 'is-active' : '' }}">
                    <i class="fa fa-bullhorn"></i><span>Alerts</span>
                </a>
                <a href="{{ route('admin.branding.index') }}" class="sidebar__link {{ starts_with($route, 'admin.branding') ? 'is-active' : '' }}">
                    <i class="fa fa-paint-brush"></i><span>Branding</span>
                </a>
                <a href="{{ route('admin.integrations.index') }}" class="sidebar__link {{ starts_with($route, 'admin.integrations') ? 'is-active' : '' }}">
                    <i class="fa fa-plug"></i><span>Integrations</span>
                </a>
                <a href="{{ route('admin.subdomains.index') }}" class="sidebar__link {{ starts_with($route, 'admin.subdomains') ? 'is-active' : '' }}">
                    <i class="fa fa-globe"></i><span>Subdomains</span>
                </a>
                <a href="{{ route('admin.license.index') }}" class="sidebar__link {{ starts_with($route, 'admin.license') ? 'is-active' : '' }}">
                    <i class="fa fa-id-badge"></i><span>License</span>
                </a>
            </nav>
        </aside>

        <div class="main">
            <header class="topstrip">
                <div class="topstrip__title">
                    @hasSection('header-title')
                        <h1>@yield('header-title')</h1>
                        @hasSection('header-sub')
                            <small>@yield('header-sub')</small>
                        @endif
                    @endif
                </div>
                <div class="topstrip__actions">
                    <a href="{{ route('index') }}" class="user-pill" title="Exit admin">
                        <img src="https://www.gravatar.com/avatar/{{ md5(strtolower(Auth::user()->email)) }}?s=48"
                             alt="">
                        <span>{{ Auth::user()->name_first }}</span>
                    </a>
                </div>
            </header>

            <main class="content">
                {{-- legacy admin pages still using @section('content-header') for h1 + breadcrumb --}}
                @hasSection('content-header')
                    <div class="legacy-content-header">
                        @yield('content-header')
                    </div>
                @endif

                @if (count($errors) > 0)
                    <div class="alert alert--danger">
                        <strong>There was an error validating the data provided.</strong>
                        <ul>
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                @foreach (Alert::getMessages() as $type => $messages)
                    @foreach ($messages as $message)
                        @php $cls = in_array($type, ['success','info','warning','danger']) ? $type : 'info'; @endphp
                        <div class="alert alert--{{ $cls }}">{!! $message !!}</div>
                    @endforeach
                @endforeach

                @yield('content')
            </main>
        </div>
    </div>

    {{-- legacy JS deps shared across rebuilt admin pages (modals, multi-selects, confirm dialogs) --}}
    {!! Theme::js('vendor/jquery/jquery.min.js?t={cache-version}') !!}
    {!! Theme::js('vendor/bootstrap/bootstrap.min.js?t={cache-version}') !!}
    {!! Theme::js('vendor/select2/select2.full.min.js?t={cache-version}') !!}
    {!! Theme::js('vendor/sweetalert/sweetalert.min.js?t={cache-version}') !!}
    {!! Theme::js('js/admin/functions.js?t={cache-version}') !!}

    @yield('footer-scripts')
</body>
</html>
